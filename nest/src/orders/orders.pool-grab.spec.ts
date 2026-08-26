import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
const MASTER_USER_ID = 'master-user';
const MASTER_ID = 'master-1';

const ACTIVE_MASTER = {
  id: MASTER_ID,
  status: 'active',
  serviceAreas: [{ provinceCode: '11', cityCode: null, districtCode: null }],
  provinceCode: '11',
  cityCode: null,
  districtCode: null,
};

const PENDING_MASTER = { ...ACTIVE_MASTER, status: 'pending' };
const DISABLED_MASTER = { ...ACTIVE_MASTER, status: 'disabled' };

const POOL_ORDER_1 = {
  id: 'pool-1',
  status: OrderStatus.PendingAccept,
  masterId: null,
  serviceItem: { name: '空调清洗' },
  address: { provinceCode: '11', cityCode: null, districtCode: null },
};

const POOL_ORDER_2 = {
  id: 'pool-2',
  status: OrderStatus.PendingAccept,
  masterId: null,
  serviceItem: { name: '冰箱维修' },
  address: { provinceCode: '33', cityCode: null, districtCode: null },
};

function setupService(opts?: {
  master?: any;
  orders?: any[];
  order?: any;
  updateManyResult?: { count: number };
}) {
  const prisma = createMockPrisma();
  const commission = createMockCommission();
  const payments = createMockOrders();
  const settlements = createMockSettlements();
  const gateway = createMockGateway();

  prisma.master.findUnique.mockResolvedValue(opts?.master === undefined ? ACTIVE_MASTER : opts.master);
  prisma.order.findMany.mockResolvedValue(opts?.orders ?? [POOL_ORDER_1, POOL_ORDER_2]);
  prisma.order.findUnique.mockResolvedValue(opts?.order ?? {
    address: { provinceCode: '11', cityCode: null, districtCode: null },
  });
  prisma.order.updateMany.mockResolvedValue(opts?.updateManyResult ?? { count: 1 });

  const service = new OrdersService(prisma, settlements, payments as any, commission, gateway);
  const transitionSpy = jest.spyOn(service as any, 'transition').mockResolvedValue({ id: ORDER_ID });

  return { service, prisma, payments, settlements, commission, gateway, transitionSpy };
}

describe('OrdersService.pool - 师傅审核状态校验', () => {
  it('active 师傅 → 返回地域匹配的订单', async () => {
    const { service } = setupService({ master: ACTIVE_MASTER });
    const result = await service.pool(MASTER_USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pool-1');
  });

  it('pending 师傅 → 返回空数组', async () => {
    const { service } = setupService({ master: PENDING_MASTER });
    const result = await service.pool(MASTER_USER_ID);
    expect(result).toEqual([]);
  });

  it('disabled 师傅 → 返回空数组', async () => {
    const { service } = setupService({ master: DISABLED_MASTER });
    const result = await service.pool(MASTER_USER_ID);
    expect(result).toEqual([]);
  });

  it('master 不存在 → 返回空数组', async () => {
    const { service } = setupService({ master: null });
    const result = await service.pool(MASTER_USER_ID);
    expect(result).toEqual([]);
  });

  it('无 masterId 上下文 → 返回全部（兜底宽松）', async () => {
    const { service } = setupService();
    const result = await service.pool();
    expect(result).toHaveLength(2);
  });
});

describe('OrdersService.grab - 师傅审核状态校验', () => {
  it('active 师傅 + 区域匹配 + 抢占成功 → 调用 transition', async () => {
    const { service, transitionSpy } = setupService();
    await service.grab(ORDER_ID, MASTER_USER_ID);
    expect(transitionSpy).toHaveBeenCalledWith(
      ORDER_ID, OrderStatus.Accepted, MASTER_USER_ID, '师傅抢单',
    );
  });

  it('pending 师傅 → ForbiddenException（账号尚未通过审核）', async () => {
    const { service, transitionSpy, prisma } = setupService({ master: PENDING_MASTER });
    await expect(service.grab(ORDER_ID, MASTER_USER_ID)).rejects.toThrow(ForbiddenException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(transitionSpy).not.toHaveBeenCalled();
  });

  it('disabled 师傅 → ForbiddenException（账号尚未通过审核）', async () => {
    const { service, transitionSpy, prisma } = setupService({ master: DISABLED_MASTER });
    await expect(service.grab(ORDER_ID, MASTER_USER_ID)).rejects.toThrow(ForbiddenException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(transitionSpy).not.toHaveBeenCalled();
  });

  it('区域不匹配 → BadRequestException（您不在该订单的服务区域）', async () => {
    const { service } = setupService({
      master: ACTIVE_MASTER,
      order: { address: { provinceCode: '99', cityCode: null, districtCode: null } },
    });
    await expect(service.grab(ORDER_ID, MASTER_USER_ID)).rejects.toThrow(BadRequestException);
  });

  it('订单已被其他师傅接走 → BadRequestException（手慢了）', async () => {
    const { service, transitionSpy } = setupService({ updateManyResult: { count: 0 } });
    await expect(service.grab(ORDER_ID, MASTER_USER_ID)).rejects.toThrow(BadRequestException);
    expect(transitionSpy).not.toHaveBeenCalled();
  });

  it('master 不存在 → BadRequestException（当前账号不是师傅）', async () => {
    const { service, prisma } = setupService();
    prisma.master.findUnique.mockResolvedValue(null);
    await expect(service.grab(ORDER_ID, MASTER_USER_ID)).rejects.toThrow(BadRequestException);
  });
});
