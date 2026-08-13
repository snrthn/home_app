import { randomBytes } from 'node:crypto';
import {
  PaymentProvider,
  PaymentProviderName,
  ChargeInput,
  ChargeResult,
  NotifyPayload,
  NotifyResult,
  RefundInput,
  RefundResult,
} from './provider';

// 模拟支付通道：不接真实三方，前端点「模拟支付成功」即回调本通道。
// 关键：verifyNotify 走与真实通道一致的「异步回调」范式，保证后期换微信/支付宝只是配置切换、代码零改动。
export class MockPaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'mock';

  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    const tradeNo =
      'MOCK' + Date.now().toString(36).toUpperCase() + randomBytes(3).toString('hex');
    // mock 无需真实预下单，前端拿到 token 后调用 /payments/mock/notify 模拟支付成功
    return {
      tradeNo,
      provider: 'mock',
      payParams: { type: 'mock', token: tradeNo, hint: '点击「模拟支付」完成支付' },
    };
  }

  async verifyNotify(payload: NotifyPayload): Promise<NotifyResult> {
    if (!payload.orderId || !payload.token) {
      return { orderId: payload.orderId ?? '', success: false };
    }
    // mock 通知：orderId + token(=tradeNo) 即判定成功
    return { orderId: payload.orderId, success: true, tradeNo: payload.token };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const refundNo =
      'REF' + Date.now().toString(36).toUpperCase() + randomBytes(3).toString('hex');
    return { refundNo };
  }
}
