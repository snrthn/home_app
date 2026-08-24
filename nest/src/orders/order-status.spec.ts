import { canTransition } from './order-status';
import { OrderStatus } from '@laoma/shared';

describe('canTransition - 状态机流转总闸', () => {
  describe('合法流转 → true', () => {
    it('待支付 → 待接单', () => {
      expect(canTransition(OrderStatus.PendingPayment, OrderStatus.PendingAccept)).toBe(true);
    });
    it('待支付 → 已取消', () => {
      expect(canTransition(OrderStatus.PendingPayment, OrderStatus.Cancelled)).toBe(true);
    });
    it('待接单 → 已接单', () => {
      expect(canTransition(OrderStatus.PendingAccept, OrderStatus.Accepted)).toBe(true);
    });
    it('待接单 → 退款中', () => {
      expect(canTransition(OrderStatus.PendingAccept, OrderStatus.Refunding)).toBe(true);
    });
    it('已接单 → 出发中', () => {
      expect(canTransition(OrderStatus.Accepted, OrderStatus.Departing)).toBe(true);
    });
    it('待验收 → 已完成', () => {
      expect(canTransition(OrderStatus.PendingConfirm, OrderStatus.Reviewed)).toBe(true);
    });
    it('已完成 → 已评价', () => {
      expect(canTransition(OrderStatus.Reviewed, OrderStatus.Evaluated)).toBe(true);
    });
    it('退款中 → 已退款', () => {
      expect(canTransition(OrderStatus.Refunding, OrderStatus.Refunded)).toBe(true);
    });
  });

  describe('非法流转 → false', () => {
    it('待支付 → 已接单（跳过支付）', () => {
      expect(canTransition(OrderStatus.PendingPayment, OrderStatus.Accepted)).toBe(false);
    });
    it('已接单 → 已完成（跳过履约）', () => {
      expect(canTransition(OrderStatus.Accepted, OrderStatus.Reviewed)).toBe(false);
    });
    it('已退款 → 待接单（终态不可回退）', () => {
      expect(canTransition(OrderStatus.Refunded, OrderStatus.PendingAccept)).toBe(false);
    });
    it('已取消 → 待支付（终态不可回退）', () => {
      expect(canTransition(OrderStatus.Cancelled, OrderStatus.PendingPayment)).toBe(false);
    });
    it('已评价 → 待验收（终态不可回退）', () => {
      expect(canTransition(OrderStatus.Evaluated, OrderStatus.PendingConfirm)).toBe(false);
    });
    it('出发中 → 待接单（不可回退）', () => {
      expect(canTransition(OrderStatus.Departing, OrderStatus.PendingAccept)).toBe(false);
    });
    it('同状态流转（自环）', () => {
      expect(canTransition(OrderStatus.Accepted, OrderStatus.Accepted)).toBe(false);
    });
  });

  describe('未知状态 → false', () => {
    it('未知 from', () => {
      expect(canTransition('unknown', OrderStatus.Accepted)).toBe(false);
    });
    it('未知 to', () => {
      expect(canTransition(OrderStatus.PendingPayment, 'unknown')).toBe(false);
    });
    it('双方未知', () => {
      expect(canTransition('foo', 'bar')).toBe(false);
    });
    it('空字符串', () => {
      expect(canTransition('', OrderStatus.Accepted)).toBe(false);
    });
  });

  describe('终态无出口', () => {
    it('已退款 → 任意', () => {
      expect(canTransition(OrderStatus.Refunded, OrderStatus.PendingAccept)).toBe(false);
      expect(canTransition(OrderStatus.Refunded, OrderStatus.Cancelled)).toBe(false);
      expect(canTransition(OrderStatus.Refunded, OrderStatus.Refunding)).toBe(false);
    });
    it('已取消 → 任意', () => {
      expect(canTransition(OrderStatus.Cancelled, OrderStatus.PendingPayment)).toBe(false);
      expect(canTransition(OrderStatus.Cancelled, OrderStatus.Refunding)).toBe(false);
    });
  });
});
