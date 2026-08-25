import { createSign, createVerify } from 'node:crypto';
import { format2 } from '../common/money';
import type {
  PaymentProvider,
  PaymentProviderName,
  ChargeInput,
  ChargeResult,
  NotifyPayload,
  NotifyResult,
  RefundInput,
  RefundResult,
} from './provider';
import type { MerchantConfig } from './merchant-config.store';

// 支付宝 OpenAPI 实现（原生 crypto，RSA2 签名，无第三方 SDK 依赖）。
// 配置字段映射（MerchantConfig）：
//   appId      -> 支付宝应用 ID
//   apiKey     -> 应用私钥（appPrivateKey，PEM，用于加签）
//   appSecret  -> 支付宝公钥（alipayPublicKey，PEM，用于回调解密验签）
// 另有环境变量（不入库）：ALIPAY_GATEWAY（默认正式网关）、ALIPAY_NOTIFY_URL（公网回调地址）

const ALIPAY_GATEWAY =
  process.env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do';
const ALIPAY_NOTIFY_URL = process.env.ALIPAY_NOTIFY_URL ?? '';

export class AlipayPaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'alipay';
  private appId: string;
  private appPrivateKey: string;
  private alipayPublicKey: string;

  constructor(cfg: MerchantConfig) {
    this.appId = cfg.appId ?? '';
    this.appPrivateKey = cfg.apiKey ?? '';
    this.alipayPublicKey = cfg.appSecret ?? '';
    if (!this.appId || !this.appPrivateKey || !this.alipayPublicKey) {
      throw new Error(
        '支付宝配置不完整：需 appId / apiKey(应用私钥) / appSecret(支付宝公钥)',
      );
    }
  }

  private buildParams(
    method: string,
    bizContent: Record<string, any>,
    extra: Record<string, any> = {},
  ): Record<string, any> {
    return {
      app_id: this.appId,
      method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toLocaleString('sv-SE').replace('T', ' '),
      version: '1.0',
      notify_url: ALIPAY_NOTIFY_URL,
      ...extra,
      biz_content: JSON.stringify(bizContent),
    };
  }

  private sign(params: Record<string, any>): string {
    const sorted = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== '' && k !== 'sign')
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return createSign('RSA-SHA256').update(sorted, 'utf8').sign(
      this.appPrivateKey,
      'base64',
    );
  }

  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    const method = 'alipay.trade.create';
    const biz = {
      out_trade_no: input.orderNo,
      total_amount: format2(input.amount),
      subject: input.subject,
      product_code: 'GENERAL_WITHHOLDING',
    };
    const params = this.buildParams(method, biz);
    params.sign = this.sign(params);
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(ALIPAY_GATEWAY + '?' + query, { method: 'POST' });
    const data = JSON.parse(await res.text());
    const result = data['alipay_trade_create_response'];
    if (!result || result.code !== '10000') {
      throw new Error('支付宝预下单失败: ' + JSON.stringify(data));
    }
    return {
      tradeNo: input.orderNo,
      provider: 'alipay',
      payParams: { type: 'alipay', tradeNo: result.trade_no },
    };
  }

  async verifyNotify(payload: NotifyPayload): Promise<NotifyResult> {
    const params = (payload.raw ?? {}) as Record<string, any>;
    const sign = params.sign;
    if (!sign) return { orderId: '', success: false };
    const toVerify = Object.keys(params)
      .filter(
        (k) =>
          k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== '',
      )
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    const ok = createVerify('RSA-SHA256')
      .update(toVerify, 'utf8')
      .verify(this.alipayPublicKey, Buffer.from(sign, 'base64'));
    const success =
      ok &&
      (params.trade_status === 'TRADE_SUCCESS' ||
        params.trade_status === 'TRADE_FINISHED');
    return {
      orderId: params.out_trade_no ?? '',
      success,
      tradeNo: params.trade_no,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const method = 'alipay.trade.refund';
    const biz = {
      out_trade_no: input.tradeNo,
      refund_amount: format2(input.amount),
      refund_reason: input.reason ?? '订单取消退款',
    };
    const params = this.buildParams(method, biz);
    params.sign = this.sign(params);
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(ALIPAY_GATEWAY + '?' + query, { method: 'POST' });
    const data = JSON.parse(await res.text());
    const r = data['alipay_trade_refund_response'];
    if (!r || r.code !== '10000') {
      throw new Error('支付宝退款失败: ' + JSON.stringify(data));
    }
    return { refundNo: r.trade_no ?? input.tradeNo };
  }
}
