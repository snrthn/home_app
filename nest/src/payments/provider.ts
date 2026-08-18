// 支付通道抽象（Provider 接缝）
// 设计要点：order 侧只依赖本接口，不关心底层是 mock 还是微信/支付宝。
// 后期接入真实通道时，仅需新增 WechatPaymentProvider / AlipayPaymentProvider 实现本接口，
// 并由 PaymentConfig（管理员在后台配置商户信息）决定启用哪个，业务代码零改动。

export type PaymentProviderName = 'mock' | 'wechat' | 'alipay';

export interface ChargeInput {
  orderId: string;
  orderNo: string;
  amount: number; // 元
  subject: string;
  customerId: string;
}

export interface ChargeResult {
  tradeNo: string; // 平台内部交易号
  provider: PaymentProviderName;
  // 前端调起支付所需参数。mock: { type:'mock', token }；真实通道: prepay_id / 签名串 等
  payParams: Record<string, any>;
  expireAt?: string;
}

export interface NotifyPayload {
  orderId?: string;
  token?: string; // mock 通知携带
  raw?: any; // 真实通道异步回调原始报文
}

export interface NotifyResult {
  orderId: string;
  success: boolean;
  tradeNo?: string;
}

export interface RefundInput {
  tradeNo: string;
  amount: number; // 本次退款金额（元），部分退款时小于订单原额
  originalAmount?: number; // 订单原额（元）：微信退款需同时上报 refund/total，部分退款时必传
  reason?: string;
}

export interface RefundResult {
  refundNo: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** 下单预创建支付单，返回调起支付所需参数 */
  createCharge(input: ChargeInput): Promise<ChargeResult>;
  /** 校验异步回调（真实通道需验签），返回本次支付结果。必须幂等 */
  verifyNotify(payload: NotifyPayload): Promise<NotifyResult>;
  /** 发起退款，返回退款单号 */
  refund(input: RefundInput): Promise<RefundResult>;
}
