import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { createMockPrisma, createMockCommission } from '../test/mocks';

const ORDER_ID = 'order-1';
const MASTER_ID = 'master-1';

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: ORDER_ID,
    masterId: MASTER_ID,
    amount: 100,
    status: 'reviewed',
    ...overrides,
  };
}

function setupService(opts?: { order?: any; existing?: any; snap?: any; split?: any }) {
  const prisma = createMockPrisma();
  const commission = createMockCommission();

  prisma.order.findUnique.mockResolvedValue(opts?.order ?? makeOrder());
  prisma.settlement.findUnique.mockResolvedValue(opts?.existing ?? null);
  prisma.settlement.create.mockResolvedValue({ id: 'settle-1', orderId: ORDER_ID });
  prisma.settlement.update.mockResolvedValue({ id: 'settle-1', status: 'credited' });

  commission.snapshotFromOrder.mockResolvedValue(opts?.snap ?? {
    platformRate: 0.1,
    refundPolicy: 'tiered',
    refundTiers: {},
    source: 'default',
    resolvedAt: '2026-01-01T00:00:00.000Z',
  });
  commission.splitNormal.mockReturnValue(opts?.split ?? {
    platformFee: 10,
    masterAmount: 90,
  });

  const service = new SettlementsService(prisma, commission);
  return { service, prisma, commission };
}

describe('SettlementsService.releaseToMaster - 幂等', () => {
  describe('前置校验', () => {
    it('订单不存在 → NotFoundException', async () => {
      const { service, prisma } = setupService({ order: null });
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.releaseToMaster(ORDER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('幂等', () => {
    it('已有结算单 → 直接返回，不 create', async () => {
      const existing = { id: 'settle-old', orderId: ORDER_ID, status: 'credited' };
      const { service, prisma, commission } = setupService({ existing });
      const result = await service.releaseToMaster(ORDER_ID);
      expect(result).toBe(existing);
      expect(commission.snapshotFromOrder).not.toHaveBeenCalled();
      expect(prisma.settlement.create).not.toHaveBeenCalled();
    });

    it('无结算单 → create 新记录', async () => {
      const { service, prisma } = setupService({ existing: null });
      await service.releaseToMaster(ORDER_ID);
      expect(prisma.settlement.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('分账正确', () => {
    it('platformRate=0.1 → platformFee=10, masterAmount=90', async () => {
      const { service, prisma, commission } = setupService({
        split: { platformFee: 10, masterAmount: 90 },
      });
      await service.releaseToMaster(ORDER_ID);
      expect(commission.splitNormal).toHaveBeenCalledWith(100, expect.any(Object));
      expect(prisma.settlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platformFee: 10,
            masterAmount: 90,
            orderAmount: 100,
          }),
        }),
      );
    });

    it('platformRate=0 → 全归师傅', async () => {
      const { service, prisma } = setupService({
        split: { platformFee: 0, masterAmount: 100 },
      });
      await service.releaseToMaster(ORDER_ID);
      expect(prisma.settlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platformFee: 0,
            masterAmount: 100,
          }),
        }),
      );
    });
  });

  describe('入账参数', () => {
    it('type=normal, status=credited', async () => {
      const { service, prisma } = setupService();
      await service.releaseToMaster(ORDER_ID);
      expect(prisma.settlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'normal',
            status: 'credited',
            orderId: ORDER_ID,
            masterId: MASTER_ID,
          }),
        }),
      );
    });

    it('settledAt 为当前时间', async () => {
      const { service, prisma } = setupService();
      const before = Date.now();
      await service.releaseToMaster(ORDER_ID);
      const call = prisma.settlement.create.mock.calls[0][0];
      expect(call.data.settledAt).toBeInstanceOf(Date);
      expect(call.data.settledAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('note 包含佣金率和规则来源', async () => {
      const { service, prisma } = setupService({
        snap: { platformRate: 0.1, source: 'service:abc', resolvedAt: '' },
      });
      await service.releaseToMaster(ORDER_ID);
      const call = prisma.settlement.create.mock.calls[0][0];
      expect(call.data.note).toContain('10.00%');
      expect(call.data.note).toContain('service:abc');
    });
  });
});

describe('SettlementsService.createCompensation - 补偿单', () => {
  it('comp <= 0 → 返回 null', async () => {
    const { service } = setupService();
    const result = await service.createCompensation(ORDER_ID, 0, 5, 'default');
    expect(result).toBeNull();
  });

  it('comp < 0 → 返回 null', async () => {
    const { service } = setupService();
    const result = await service.createCompensation(ORDER_ID, -10, 5, 'default');
    expect(result).toBeNull();
  });

  it('订单不存在 → 返回 null', async () => {
    const { service, prisma } = setupService({ order: null });
    prisma.order.findUnique.mockResolvedValue(null);
    const result = await service.createCompensation(ORDER_ID, 20, 5, 'default');
    expect(result).toBeNull();
  });

  it('masterId 为 null → 返回 null', async () => {
    const { service, prisma } = setupService({ order: makeOrder({ masterId: null }) });
    prisma.order.findUnique.mockResolvedValue(makeOrder({ masterId: null }));
    const result = await service.createCompensation(ORDER_ID, 20, 5, 'default');
    expect(result).toBeNull();
  });

  it('已有结算单 → 幂等返回', async () => {
    const existing = { id: 'settle-old', orderId: ORDER_ID };
    const { service, prisma } = setupService({ existing });
    const result = await service.createCompensation(ORDER_ID, 20, 5, 'default');
    expect(result).toBe(existing);
    expect(prisma.settlement.create).not.toHaveBeenCalled();
  });

  it('正常创建 → type=compensation, status=pending', async () => {
    const { service, prisma } = setupService();
    await service.createCompensation(ORDER_ID, 18, 2, 'default');
    expect(prisma.settlement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'compensation',
          status: 'pending',
          masterAmount: 18,
          platformFee: 2,
          note: expect.stringContaining('阶梯退款补偿'),
        }),
      }),
    );
  });

  it('ruleSource 写入 note', async () => {
    const { service, prisma } = setupService();
    await service.createCompensation(ORDER_ID, 18, 2, 'service:abc');
    const call = prisma.settlement.create.mock.calls[0][0];
    expect(call.data.note).toContain('service:abc');
  });
});

describe('SettlementsService.credit - 补偿单入账', () => {
  it('结算单不存在 → NotFoundException', async () => {
    const { service, prisma } = setupService();
    prisma.settlement.findUnique.mockResolvedValue(null);
    await expect(service.credit('settle-1')).rejects.toThrow(NotFoundException);
  });

  it('非 pending 状态 → BadRequestException', async () => {
    const { service, prisma } = setupService();
    prisma.settlement.findUnique.mockResolvedValue({ id: 'settle-1', status: 'credited' });
    await expect(service.credit('settle-1')).rejects.toThrow(BadRequestException);
  });

  it('pending → credited', async () => {
    const { service, prisma } = setupService();
    prisma.settlement.findUnique.mockResolvedValue({ id: 'settle-1', status: 'pending', note: 'old' });
    await service.credit('settle-1', '审核通过', 'admin-1');
    expect(prisma.settlement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'settle-1' },
        data: expect.objectContaining({
          status: 'credited',
          note: '审核通过',
          reviewedBy: 'admin-1',
        }),
      }),
    );
  });
});

describe('SettlementsService.reject - 补偿单驳回', () => {
  it('结算单不存在 → NotFoundException', async () => {
    const { service, prisma } = setupService();
    prisma.settlement.findUnique.mockResolvedValue(null);
    await expect(service.reject('settle-1', '不符合')).rejects.toThrow(NotFoundException);
  });

  it('非 pending 状态 → BadRequestException', async () => {
    const { service, prisma } = setupService();
    prisma.settlement.findUnique.mockResolvedValue({ id: 'settle-1', status: 'rejected' });
    await expect(service.reject('settle-1', '不符合')).rejects.toThrow(BadRequestException);
  });

  it('pending → rejected', async () => {
    const { service, prisma } = setupService();
    prisma.settlement.findUnique.mockResolvedValue({ id: 'settle-1', status: 'pending', note: 'old' });
    await service.reject('settle-1', '金额有误', 'admin-1');
    expect(prisma.settlement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'settle-1' },
        data: expect.objectContaining({
          status: 'rejected',
          note: '金额有误',
          reviewedBy: 'admin-1',
        }),
      }),
    );
  });
});
