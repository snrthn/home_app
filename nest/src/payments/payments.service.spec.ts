import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@laoma/shared';
import { PaymentsService } from './payments.service';
import {
  createMockPrisma,
  createMockCommission,
  createMockOrders,
  createMockSettlements,
  createMockGateway,
  createMockProvider,
} from '../test/mocks';

const ORDER_ID = 'order-1';
const CUSTOMER_ID = 'user-1';
const MASTER_ID = 'master-1';

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

function setupService(opts?: {
  order?: any;
  snap?: any;
  split?: any;
  payment?: any;
  providerRefund?: any;
}) {
  const prisma = createMockPrisma();
  const commission = createMockCommission();
  const orders = createMockOrders();
  const settlements = createMockSettlements();
  const gateway = createMockGateway();

  prisma.order.findUnique.mockResolvedValue(opts?.order ?? makeOrder());
  prisma.payment.findFirst.mockResolvedValue(opts?.payment ?? { id: 'pay-1' });
  prisma.payment.updateMany.mockResolvedValue({ count: 1 });

  commission.snapshotFromOrder.mockResolvedValue(opts?.snap ?? {
    platformRate: 0.1,
    refundPolicy: 'tiered',
    refundTiers: { [OrderStatus.Departing]: 0.8, [OrderStatus.Arrived]: 0.5 },
    source: 'default',
    resolvedAt: '2026-01-01T00:00:00.000Z',
  });
  commission.splitRefund.mockReturnValue(opts?.split ?? {
    refundRatio: 0.8,
    refundAmount: 80,
    platformKeep: 2,
    masterCompensation: 18,
  });

  const provider = createMockProvider();
  if (opts?.providerRefund !== undefined) {
    provider.refund.mockResolvedValue(opts.providerRefund);
  }

  const service = new PaymentsService(prisma, gateway, settlements, commission, orders);
  jest.spyOn(service as any, 'getProvider').mockResolvedValue(provider);

  return { service, prisma, commission, orders, settlements, gateway, provider };
}

describe('PaymentsService.refund - 三策略守卫', () => {
  describe('前置校验', () => {
    it('订单不存在 → NotFoundException', async () => {
      const { service, prisma } = setupService({ order: null });
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.refund(CUSTOMER_ID, ORDER_ID)).rejects.toThrow(NotFoundException);
    });

    it('非订单客户 → ForbiddenException', async () => {
      const { service } = setupService({ order: makeOrder({ customerId: 'other' }) });
      await expect(service.refund(CUSTOMER_ID, ORDER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('PendingPayment 不可退款 → BadRequestException', async () => {
      const { service } = setupService({ order: makeOrder({ status: OrderStatus.PendingPayment }) });
      await expect(service.refund(CUSTOMER_ID, ORDER_ID)).rejects.toThrow(BadRequestException);
    });

    it('Cancelled 不可退款 → BadRequestException', async () => {
      const { service } = setupService({ order: makeOrder({ status: OrderStatus.Cancelled }) });
      await expect(service.refund(CUSTOMER_ID, ORDER_ID)).rejects.toThrow(BadRequestException);
    });

    it('Refunded 不可退款 → BadRequestException', async () => {
      const { service } = setupService({ order: makeOrder({ status: OrderStatus.Refunded }) });
      await expect(service.refund(CUSTOMER_ID, ORDER_ID)).rejects.toThrow(BadRequestException);
    });

    it('Reviewed 默认不可退款 → BadRequestException', async () => {
      const { service } = setupService({ order: makeOrder({ status: OrderStatus.Reviewed }) });
      await expect(service.refund(CUSTOMER_ID, ORDER_ID)).rejects.toThrow(BadRequestException);
    });

    it('Reviewed + allowCompleted=true → 放行', async () => {
      const { service, orders } = setupService({ order: makeOrder({ status: OrderStatus.Reviewed }) });
      await service.refund(CUSTOMER_ID, ORDER_ID, undefined, { allowCompleted: true });
      expect(orders.transition).toHaveBeenCalled();
    });

    it('Evaluated + allowCompleted=true → 放行', async () => {
      const { service, orders } = setupService({ order: makeOrder({ status: OrderStatus.Evaluated }) });
      await service.refund(CUSTOMER_ID, ORDER_ID, undefined, { allowCompleted: true });
      expect(orders.transition).toHaveBeenCalled();
    });
  });

  describe('退款分账 - 调用链', () => {
    it('snapshotFromOrder + splitRefund 被调用', async () => {
      const { service, commission } = setupService();
      await service.refund(CUSTOMER_ID, ORDER_ID, 'departing');
      expect(commission.snapshotFromOrder).toHaveBeenCalled();
      expect(commission.splitRefund).toHaveBeenCalledWith(100, 'departing', expect.any(Object));
    });

    it('provider.refund 收到正确金额', async () => {
      const { service, provider } = setupService();
      await service.refund(CUSTOMER_ID, ORDER_ID, 'departing');
      expect(provider.refund).toHaveBeenCalledWith(
        expect.objectContaining({
          tradeNo: 'pay-1',
          amount: 80,
          originalAmount: 100,
          reason: '订单取消退款',
        }),
      );
    });

    it('payment.findFirst 查 paid 记录', async () => {
      const { service, prisma } = setupService();
      await service.refund(CUSTOMER_ID, ORDER_ID);
      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { orderId: ORDER_ID, status: 'paid' },
      });
    });

    it('payment.updateMany 标记 refunded', async () => {
      const { service, prisma } = setupService();
      await service.refund(CUSTOMER_ID, ORDER_ID);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { orderId: ORDER_ID },
        data: { status: 'refunded' },
      });
    });
  });

  describe('状态流转 - 两段式收口', () => {
    it('非 Refunding 状态 → 两段 transition（先 Refunding 再 Refunded）', async () => {
      const { service, orders } = setupService({ order: makeOrder({ status: OrderStatus.Departing }) });
      await service.refund(CUSTOMER_ID, ORDER_ID, 'departing');
      expect(orders.transition).toHaveBeenCalledTimes(2);
      // 第一段：→ Refunding
      expect(orders.transition).toHaveBeenNthCalledWith(
        1, ORDER_ID, OrderStatus.Refunding, CUSTOMER_ID,
        expect.any(String), undefined, 'refund',
      );
      // 第二段：→ Refunded
      expect(orders.transition).toHaveBeenNthCalledWith(
        2, ORDER_ID, OrderStatus.Refunded, CUSTOMER_ID,
        expect.any(String), undefined, 'refund',
      );
    });

    it('已 Refunding → 跳过第一段，只 transition 一次（→ Refunded）', async () => {
      const { service, orders } = setupService({ order: makeOrder({ status: OrderStatus.Refunding }) });
      await service.refund(CUSTOMER_ID, ORDER_ID, 'refunding');
      expect(orders.transition).toHaveBeenCalledTimes(1);
      expect(orders.transition).toHaveBeenCalledWith(
        ORDER_ID, OrderStatus.Refunded, CUSTOMER_ID,
        expect.any(String), undefined, 'refund',
      );
    });
  });

  describe('补偿单 - createCompensation', () => {
    it('masterCompensation > 0 + masterId 存在 → 创建补偿单', async () => {
      const { service, settlements } = setupService({
        split: { refundRatio: 0.8, refundAmount: 80, platformKeep: 2, masterCompensation: 18 },
      });
      await service.refund(CUSTOMER_ID, ORDER_ID, 'departing');
      expect(settlements.createCompensation).toHaveBeenCalledWith(
        ORDER_ID, 18, 2, 'default',
      );
    });

    it('masterCompensation = 0 → 不创建补偿单', async () => {
      const { service, settlements } = setupService({
        split: { refundRatio: 1, refundAmount: 100, platformKeep: 0, masterCompensation: 0 },
      });
      await service.refund(CUSTOMER_ID, ORDER_ID, 'departing');
      expect(settlements.createCompensation).not.toHaveBeenCalled();
    });

    it('masterId 为 null → 不创建补偿单（即使有补偿金额）', async () => {
      const { service, settlements } = setupService({
        order: makeOrder({ masterId: null }),
        split: { refundRatio: 0.8, refundAmount: 80, platformKeep: 2, masterCompensation: 18 },
      });
      await service.refund(CUSTOMER_ID, ORDER_ID, 'departing');
      expect(settlements.createCompensation).not.toHaveBeenCalled();
    });
  });

  describe('退款原因透传', () => {
    it('自定义 reason 透传给 provider', async () => {
      const { service, provider } = setupService();
      await service.refund(CUSTOMER_ID, ORDER_ID, 'departing', { reason: '师傅迟到' });
      expect(provider.refund).toHaveBeenCalledWith(
        expect.objectContaining({ reason: '师傅迟到' }),
      );
    });
  });

  describe('返回值', () => {
    it('返回 split 结果', async () => {
      const { service } = setupService({
        split: { refundRatio: 0.8, refundAmount: 80, platformKeep: 2, masterCompensation: 18 },
      });
      const result = await service.refund(CUSTOMER_ID, ORDER_ID, 'departing');
      expect(result).toEqual({
        refundRatio: 0.8,
        refundAmount: 80,
        platformKeep: 2,
        masterCompensation: 18,
      });
    });
  });
});
