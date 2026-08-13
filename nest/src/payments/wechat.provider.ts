import { randomBytes, createSign, createDecipheriv } from 'node:crypto';
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

// 微信支付 V3 实现（原生 crypto，无第三方 SDK 依赖）。
// 配置字段映射（MerchantConfig）：
//   appId      -> 公众号/小程序 AppID
//   mchId      -> 商户号
//   appSecret  -> APIv3 密钥（用于回调解密 AES-256-GCM）
//   apiKey     -> 商户 API 私钥（apiclient_key.pem，用于签名 Authorization）
// 另有环境变量（不入库）：WX_MCH_SERIAL（证书序列号）、WX_NOTIFY_URL（公网回调地址）
// 注意：回调仅做 resource 解密，未校验微信平台证书签名（需下载平台证书，骨架阶段从简，联调时补全）。

const WX_API = 'https://api.mch.weixin.qq.com';
const WX_SERIAL = process.env.WX_MCH_SERIAL ?? '';
const WX_NOTIFY_URL = process.env.WX_NOTIFY_URL ?? '';

export class WechatPaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'wechat';
  private appId: string;
  private mchId: string;
  private apiV3Key: string;
  private privateKeyPem: string;

  constructor(cfg: MerchantConfig) {
    this.appId = cfg.appId ?? '';
    this.mchId = cfg.mchId ?? '';
    this.apiV3Key = cfg.appSecret ?? '';
    this.privateKeyPem = cfg.apiKey ?? '';
    if (!this.appId || !this.mchId || !this.apiV3Key || !this.privateKeyPem) {
      throw new Error(
        '微信支付配置不完整：需 appId / mchId / appSecret(APIv3密钥) / apiKey(商户API私钥)',
      );
    }
  }

  /** 生成微信 V3 Authorization 签名头 */
  private buildAuth(method: string, path: string, body = ''): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString('hex');
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
    const signature = createSign('RSA-SHA256')
      .update(message)
      .sign(this.privateKeyPem, 'base64');
    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${WX_SERIAL}"`;
  }

  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    const path = '/v3/pay/transactions/jsapi';
    const bodyObj = {
      appid: this.appId,
      mchid: this.mchId,
      description: input.subject,
      out_trade_no: input.orderNo,
      notify_url: WX_NOTIFY_URL,
      amount: { total: Math.round(input.amount * 100), currency: 'CNY' },
    };
    const body = JSON.stringify(bodyObj);
    const res = await fetch(WX_API + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: this.buildAuth('POST', path, body),
      },
      body,
    });
    if (!res.ok) throw new Error('微信预下单失败: ' + (await res.text()));
    const data: any = await res.json();
    return {
      tradeNo: input.orderNo,
      provider: 'wechat',
      payParams: { type: 'wechat', prepayId: data.prepay_id },
    };
  }

  async verifyNotify(payload: NotifyPayload): Promise<NotifyResult> {
    const resource = (payload.raw as any)?.resource;
    if (!resource?.ciphertext) return { orderId: '', success: false };
    const plain = this.decryptResource(resource);
    const success = plain.trade_state === 'SUCCESS';
    return {
      orderId: plain.out_trade_no ?? '',
      success,
      tradeNo: plain.transaction_id,
    };
  }

  private decryptResource(resource: {
    ciphertext: string;
    nonce: string;
    associated_data?: string;
  }): any {
    const data = Buffer.from(resource.ciphertext, 'base64');
    const authTag = data.subarray(data.length - 16);
    const encrypted = data.subarray(0, data.length - 16);
    const iv = Buffer.from(resource.nonce, 'base64');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.apiV3Key, 'utf8'),
      iv,
    );
    decipher.setAuthTag(authTag);
    if (resource.associated_data) {
      decipher.setAAD(Buffer.from(resource.associated_data));
    }
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const path = '/v3/refund/domestic/refunds';
    const outRefundNo = 'ref_' + input.tradeNo + '_' + Date.now();
    const total = Math.round(input.amount * 100);
    const bodyObj = {
      out_trade_no: input.tradeNo,
      out_refund_no: outRefundNo,
      reason: input.reason ?? '订单取消退款',
      amount: { refund: total, total, currency: 'CNY' },
    };
    const body = JSON.stringify(bodyObj);
    const res = await fetch(WX_API + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: this.buildAuth('POST', path, body),
      },
      body,
    });
    if (!res.ok) throw new Error('微信退款失败: ' + (await res.text()));
    const data: any = await res.json();
    return { refundNo: data.out_refund_no ?? outRefundNo };
  }
}
