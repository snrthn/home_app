import { BadRequestException, NotFoundException } from '@nestjs/common';
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
const MASTER_USER_ID = 'master-user';
const ADMIN_ID = 'admin-1';

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: ORDER_ID,
    customerId: CUSTOMER_ID,
    masterId: null,
    amount: 100,
    status: OrderStatus.PendingAccept,
    address: { provinceCode: '11', cityCode: null, districtCode: null },
    ...overrides,
  };
}

// 不 mock transition，让真实代码执行
function setupRealTransitionService(opts?: { order?: any; updateManyResult?: { count: number } }) {
  const prisma = createMockPrisma();
  const commission = createMockCommission();
  const payments = createMockOrders();
  const settlements = createMockSettlements();
  const gateway = createMockGateway();

  prisma.order.findUnique.mockResolvedValue(opts?.order ?? makeOrder());
  prisma.order.updateMany.mockResolvedValue(opts?.updateManyResult ?? { count: 1 });

  const service = new OrdersService(prisma, settlements, payments as any, commission, gateway);
  return { service, prisma, gateway };
}

// mock transition（给 assign/grab 用）
function setupService(opts?: { order?: any; updateManyResult?: { count: number }; master?: any }) {
  const prisma = createMockPrisma();
  const commission = createMockCommission();
  const payments = createMockOrders();
  const settlements = createMockSettlements();
  const gateway = createMockGateway();

  prisma.order.findUnique.mockResolvedValue(opts?.order ?? makeOrder());
  prisma.order.updateMany.mockResolvedValue(opts?.updateManyResult ?? { count: 1 });
  prisma.master.findUnique.mockResolvedValue(opts?.master ?? {
    id: MASTER_ID,
    status: 'active',
    serviceAreas: [{ provinceCode: '11', cityCode: null, districtCode: null }],
    provinceCode: '11',
    cityCode: null,
    districtCode: null,
  });

  const service = new OrdersService(prisma, settlements, payments as any, commission, gateway);
  const transitionSpy = jest.spyOn(service as any, 'transition').mockResolvedValue(makeOrder());
  return { service, prisma, transitionSpy };
}

describe('OrdersService 竞态 & 幂等防护', () => {
  describe('transition() 乐观锁', () => {
    it('并发流转：状态已被修改 → updateMany count=0 → BadRequestException', async () => {
      const { service, prisma } = setupRealTransitionService({
        order: makeOrder({ status: OrderStatus.PendingAccept }),
        updateManyResult: { count: 0 },
      });
      await expect(
        service.transition(ORDER_ID, OrderStatus.Accepted, MASTER_USER_ID, '师傅抢单'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: OrderStatus.PendingAccept },
        data: { status: OrderStatus.Accepted },
      });
    });

    it('正常流转：count=1 → 写日志 + 广播', async () => {
      const { service, prisma, gateway } = setupRealTransitionService({
        order: makeOrder({ status: OrderStatus.PendingAccept }),
        updateManyResult: { count: 1 },
      });
      prisma.order.findUnique
        .mockResolvedValueOnce(makeOrder({ status: OrderStatus.PendingAccept }))
        .mockResolvedValueOnce(makeOrder({ status: OrderStatus.Accepted }));

      await service.transition(ORDER_ID, OrderStatus.Accepted, MASTER_USER_ID, '师傅抢单');

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: OrderStatus.PendingAccept },
        data: { status: OrderStatus.Accepted },
      });
      expect(prisma.orderLog.create).toHaveBeenCalled();
      expect(gateway.broadcastOrderUpdate).toHaveBeenCalled();
    });

    it('订单不存在 → NotFoundException', async () => {
      const { service, prisma } = setupRealTransitionService();
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.transition(ORDER_ID, OrderStatus.Accepted),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assign() 派单乐观锁', () => {
    it('正常派单：订单待接单+无师傅 → 占位成功 + transition', async () => {
      const { service, transitionSpy } = setupService({
        order: makeOrder({ status: OrderStatus.PendingAccept, masterId: null }),
      });
      await service.assign(ORDER_ID, MASTER_ID, ADMIN_ID);
      expect(transitionSpy).toHaveBeenCalledWith(
        ORDER_ID, OrderStatus.Accepted, ADMIN_ID, '管理员指派',
      );
    });

    it('已被抢走：count=0 → BadRequestException', async () => {
      const { service, transitionSpy } = setupService({
        order: makeOrder({ status: OrderStatus.Accepted, masterId: 'other' }),
        updateManyResult: { count: 0 },
      });
      await expect(service.assign(ORDER_ID, MASTER_ID, ADMIN_ID)).rejects.toThrow(BadRequestException);
      expect(transitionSpy).not.toHaveBeenCalled();
    });

    it('派单和抢单交叉锁：同一订单不可同时被派和抢', async () => {
      const { service, prisma } = setupService({
        order: makeOrder({ status: OrderStatus.PendingAccept, masterId: null }),
      });
      // grab 成功（count=1），assign 再尝试（count=0）
      prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });

      await service.grab(ORDER_ID, MASTER_USER_ID);
      await expect(service.assign(ORDER_ID, 'other-master', ADMIN_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('create() 下单幂等去重', () => {
    function setupCreateService(opts?: { existing?: any; item?: any; addr?: any; areas?: any[] }) {
      const prisma = createMockPrisma();
      // 补充 create() 用到但 mocks.ts 缺失的方法
      (prisma as any).address = { findFirst: jest.fn() };
      (prisma as any).serviceArea = { findMany: jest.fn() };

      const commission = createMockCommission();
      commission.resolve.mockResolvedValue({ platformRate: 0.1, source: 'test' });
      const payments = createMockOrders();
      const settlements = createMockSettlements();
      const gateway = createMockGateway();

      prisma.serviceItem.findUnique.mockResolvedValue(
        opts?.item ?? { id: 'item-1', isActive: true, price: 100, name: '空调清洗' },
      );
      (prisma as any).address.findFirst.mockResolvedValue(
        opts?.addr ?? { id: 'addr-1', provinceCode: '11', cityCode: null, districtCode: null, city: '北京' },
      );
      (prisma as any).serviceArea.findMany.mockResolvedValue(
        opts?.areas ?? [{ level: 'province', provinceCode: '11', cityCode: null, districtCode: null }],
      );
      prisma.order.findFirst = jest.fn().mockResolvedValue(opts?.existing ?? null);
      (prisma.order as any).create = jest.fn().mockResolvedValue(makeOrder({ status: OrderStatus.PendingPayment }));

      const service = new OrdersService(prisma, settlements, payments as any, commission, gateway);
      return { service, prisma };
    }

    it('5 分钟内重复下单 → 返回已有订单', async () => {
      const existing = makeOrder({ status: OrderStatus.PendingPayment });
      const { service, prisma } = setupCreateService({ existing });

      const result = await service.create(CUSTOMER_ID, {
        serviceItemId: 'item-1',
        addressId: 'addr-1',
      } as any);

      expect(result).toBe(existing);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('无重复订单 → 正常创建', async () => {
      const { service, prisma } = setupCreateService({ existing: null });

      const result = await service.create(CUSTOMER_ID, {
        serviceItemId: 'item-1',
        addressId: 'addr-1',
      } as any);

      expect(prisma.order.create).toHaveBeenCalled();
      expect(result.status).toBe(OrderStatus.PendingPayment);
    });
  });
});
