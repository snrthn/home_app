import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { OrderStatus } from '@laoma/shared';
import { OrdersService } from './orders.service';
import {
  createMockPrisma,
  createMockCommission,
  createMockOrders,
  createMockSettlements,
  createMockGateway,
} from '../test/mocks';

const ORDER_ID = 'order-1';
const CUSTOMER_ID = 'user-1';
const MASTER_ID = 'master-1';
const OTHER_USER = 'user-2';

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: ORDER_ID,
    customerId: CUSTOMER_ID,
    masterId: MASTER_ID,
    amount: 100,
    status: OrderStatus.Departing,
    address: { provinceCode: '11' },
    ...overrides,
  };
}

function setupService(opts?: { order?: any; master?: any }) {
  const prisma = createMockPrisma();
  const commission = createMockCommission();
  const payments = createMockOrders(); // has refund, transition, etc.
  const settlements = createMockSettlements();
  const gateway = createMockGateway();

  prisma.order.findUnique.mockResolvedValue(opts?.order ?? makeOrder());
  prisma.master.findUnique.mockResolvedValue(opts?.master ?? null);

  // payments.refund needs to be a mock that resolves
  (payments as any).refund = jest.fn().mockResolvedValue({ refundAmount: 80 });

  const service = new OrdersService(prisma, settlements, payments as any, commission, gateway);

  // Mock transition on the service instance
  const transitionSpy = jest.spyOn(service as any, 'transition').mockResolvedValue(makeOrder());

  return { service, prisma, payments, settlements, commission, gateway, transitionSpy };
}

describe('OrdersService.cancel - 支付前/后分叉', () => {
  describe('前置校验', () => {
    it('空原因 → BadRequestException', async () => {
      const { service } = setupService();
      await expect(service.cancel(ORDER_ID, CUSTOMER_ID, false, '  ')).rejects.toThrow(BadRequestException);
    });

    it('订单不存在 → NotFoundException', async () => {
      const { service, prisma } = setupService({ order: null });
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.cancel(ORDER_ID, CUSTOMER_ID, false, '取消原因')).rejects.toThrow(NotFoundException);
    });

    it('非客户/师傅/管理员 → ForbiddenException', async () => {
      const { service } = setupService();
      await expect(service.cancel(ORDER_ID, OTHER_USER, false, '取消原因')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('权限验证', () => {
    it('客户取消自己的订单 → 通过', async () => {
      const { service, transitionSpy } = setupService({
        order: makeOrder({ status: OrderStatus.PendingPayment, customerId: CUSTOMER_ID }),
      });
      await service.cancel(ORDER_ID, CUSTOMER_ID, false, '不想要了');
      expect(transitionSpy).toHaveBeenCalled();
    });

    it('师傅取消自己接的单 → 通过', async () => {
      const { service, transitionSpy, prisma } = setupService({
        order: makeOrder({ status: OrderStatus.PendingPayment, masterId: MASTER_ID }),
        master: { id: MASTER_ID },
      });
      prisma.master.findUnique.mockResolvedValue({ id: MASTER_ID });
      await service.cancel(ORDER_ID, 'master-user', false, '无法履约');
      expect(transitionSpy).toHaveBeenCalled();
    });

    it('管理员取消任意订单 → 通过', async () => {
      const { service, transitionSpy } = setupService({
        order: makeOrder({ status: OrderStatus.PendingPayment, customerId: 'someone-else' }),
      });
      await service.cancel(ORDER_ID, 'admin-user', true, '违规订单');
      expect(transitionSpy).toHaveBeenCalled();
    });
  });

  describe('支付前取消 - 直接到 Cancelled', () => {
    it('PendingPayment → transition(Cancelled)，不调 refund', async () => {
      const { service, transitionSpy, payments } = setupService({
        order: makeOrder({ status: OrderStatus.PendingPayment }),
      });
      await service.cancel(ORDER_ID, CUSTOMER_ID, false, '不想要了');
      expect(transitionSpy).toHaveBeenCalledWith(
        ORDER_ID, OrderStatus.Cancelled, CUSTOMER_ID,
        expect.any(String), { cancelReason: '不想要了' },
      );
      expect((payments as any).refund).not.toHaveBeenCalled();
    });

    it('cancelReason 写入 extraData', async () => {
      const { service, transitionSpy } = setupService({
        order: makeOrder({ status: OrderStatus.PendingPayment }),
      });
      await service.cancel(ORDER_ID, CUSTOMER_ID, false, '价格太贵');
      expect(transitionSpy).toHaveBeenCalledWith(
        ORDER_ID, OrderStatus.Cancelled, CUSTOMER_ID,
        expect.stringContaining('价格太贵'),
        { cancelReason: '价格太贵' },
      );
    });
  });

  describe('支付后取消 - 先 Refunding 再 refund', () => {
    it('Departing → transition(Refunding) + payments.refund 被调用', async () => {
      const { service, transitionSpy, payments } = setupService({
        order: makeOrder({ status: OrderStatus.Departing }),
      });
      await service.cancel(ORDER_ID, CUSTOMER_ID, false, '师傅迟到');
      // 第一段 transition → Refunding
      expect(transitionSpy).toHaveBeenCalledWith(
        ORDER_ID, OrderStatus.Refunding, CUSTOMER_ID,
        expect.stringContaining('师傅迟到'),
        { cancelReason: '师傅迟到' },
      );
      // refund 被调用，传入 customerId + stageStatus
      expect((payments as any).refund).toHaveBeenCalledWith(
        CUSTOMER_ID, ORDER_ID, 'departing',
      );
    });

    it('Accepted → 同走退款流程', async () => {
      const { service, payments } = setupService({
        order: makeOrder({ status: OrderStatus.Accepted }),
      });
      await service.cancel(ORDER_ID, CUSTOMER_ID, false, '不想做了');
      expect((payments as any).refund).toHaveBeenCalledWith(
        CUSTOMER_ID, ORDER_ID, 'accepted',
      );
    });

    it('stageStatus 是流转前的原始状态', async () => {
      const { service, payments } = setupService({
        order: makeOrder({ status: OrderStatus.Arrived }),
      });
      await service.cancel(ORDER_ID, CUSTOMER_ID, false, '服务态度差');
      expect((payments as any).refund).toHaveBeenCalledWith(
        CUSTOMER_ID, ORDER_ID, 'arrived',
      );
    });

    it('返回 findUnique 刷新后的订单', async () => {
      const refreshed = makeOrder({ status: OrderStatus.Refunded });
      const { service, prisma } = setupService({
        order: makeOrder({ status: OrderStatus.Departing }),
      });
      prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: OrderStatus.Departing }));
      prisma.order.findUnique.mockResolvedValueOnce(refreshed);
      const result = await service.cancel(ORDER_ID, CUSTOMER_ID, false, '取消');
      expect(result).toEqual(refreshed);
    });
  });
});
