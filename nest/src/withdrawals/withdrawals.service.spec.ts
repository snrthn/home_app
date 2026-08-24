import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { createMockPrisma } from '../test/mocks';

const USER_ID = 'user-1';
const MASTER_ID = 'master-1';

function setupService(opts?: {
  master?: any;
  creditedSum?: number;
  paidSum?: number;
  pendingSum?: number;
}) {
  const prisma = createMockPrisma();

  prisma.master.findUnique.mockResolvedValue(opts?.master ?? { id: MASTER_ID });

  const txMock = {
    settlement: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { masterAmount: opts?.creditedSum ?? 200 },
      }),
    },
    withdrawal: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: 0 },
      }),
      create: jest.fn().mockResolvedValue({ id: 'wd-1', masterId: MASTER_ID, amount: 50, status: 'pending' }),
    },
  };

  // paidAgg and pendingAgg use withdrawal.aggregate — set specific return values
  txMock.withdrawal.aggregate
    .mockResolvedValueOnce({ _sum: { amount: opts?.paidSum ?? 50 } })        // paidAgg
    .mockResolvedValueOnce({ _sum: { amount: opts?.pendingSum ?? 30 } });     // pendingAgg

  prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

  const service = new WithdrawalsService(prisma);
  return { service, prisma, txMock };
}

describe('WithdrawalsService.create - 防超提', () => {
  describe('前置校验', () => {
    it('金额 <= 0 → BadRequestException', async () => {
      const { service } = setupService();
      await expect(
        service.create(USER_ID, { amount: 0, channel: 'alipay', account: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('负数金额 → BadRequestException', async () => {
      const { service } = setupService();
      await expect(
        service.create(USER_ID, { amount: -50, channel: 'alipay', account: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('师傅不存在 → NotFoundException', async () => {
      const { service, prisma } = setupService({ master: null });
      prisma.master.findUnique.mockResolvedValue(null);
      await expect(
        service.create(USER_ID, { amount: 50, channel: 'alipay', account: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('余额计算与防超提', () => {
    it('credited=200, paid=50, pending=30 → available=120', async () => {
      const { service, txMock } = setupService({ creditedSum: 200, paidSum: 50, pendingSum: 30 });
      await service.create(USER_ID, { amount: 120, channel: 'alipay', account: 'x' });
      // 三次 aggregate: credited + paid + pending
      expect(txMock.settlement.aggregate).toHaveBeenCalledTimes(1);
      expect(txMock.withdrawal.aggregate).toHaveBeenCalledTimes(2);
      // create 被调用
      expect(txMock.withdrawal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            masterId: MASTER_ID,
            amount: 120,
            status: 'pending',
          }),
        }),
      );
    });

    it('可提现 120，提 50 → 成功', async () => {
      const { service, txMock } = setupService({ creditedSum: 200, paidSum: 50, pendingSum: 30 });
      await service.create(USER_ID, { amount: 50, channel: 'alipay', account: 'x' });
      expect(txMock.withdrawal.create).toHaveBeenCalled();
    });

    it('可提现 120，提 120 → 成功（恰等）', async () => {
      const { service, txMock } = setupService({ creditedSum: 200, paidSum: 50, pendingSum: 30 });
      await service.create(USER_ID, { amount: 120, channel: 'alipay', account: 'x' });
      expect(txMock.withdrawal.create).toHaveBeenCalled();
    });

    it('可提现 120，提 120.01 → 拒绝', async () => {
      const { service, txMock } = setupService({ creditedSum: 200, paidSum: 50, pendingSum: 30 });
      await expect(
        service.create(USER_ID, { amount: 120.01, channel: 'alipay', account: 'x' }),
      ).rejects.toThrow(BadRequestException);
      expect(txMock.withdrawal.create).not.toHaveBeenCalled();
    });

    it('可提现 0，提 1 → 拒绝', async () => {
      const { service } = setupService({ creditedSum: 0, paidSum: 0, pendingSum: 0 });
      await expect(
        service.create(USER_ID, { amount: 1, channel: 'alipay', account: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('pending 提现计入占用（credited=200, paid=0, pending=180 → available=20）', async () => {
      const { service, txMock } = setupService({ creditedSum: 200, paidSum: 0, pendingSum: 180 });
      await expect(
        service.create(USER_ID, { amount: 21, channel: 'alipay', account: 'x' }),
      ).rejects.toThrow(BadRequestException);
      expect(txMock.withdrawal.create).not.toHaveBeenCalled();
    });

    it('全 null 聚合 → available=0', async () => {
      const { service, txMock } = setupService();
      // Override: all aggregates return null sums
      txMock.settlement.aggregate.mockResolvedValue({ _sum: { masterAmount: null } });
      txMock.withdrawal.aggregate.mockReset();
      txMock.withdrawal.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });
      await expect(
        service.create(USER_ID, { amount: 1, channel: 'alipay', account: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('金额精度', () => {
    it('99.999 → round2 → 100', async () => {
      const { service, txMock } = setupService({ creditedSum: 200, paidSum: 50, pendingSum: 30 });
      await service.create(USER_ID, { amount: 99.999, channel: 'alipay', account: 'x' });
      expect(txMock.withdrawal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 100 }),
        }),
      );
    });
  });
});

describe('WithdrawalsService.markPaid - 标记打款', () => {
  it('updateMany count=0 + 记录不存在 → NotFoundException', async () => {
    const { service, prisma } = setupService();
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(null);
    await expect(service.markPaid('wd-1', 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('updateMany count=0 + 非 pending → BadRequestException', async () => {
    const { service, prisma } = setupService();
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue({ id: 'wd-1', status: 'paid' });
    await expect(service.markPaid('wd-1', 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('pending → paid（乐观锁）', async () => {
    const { service, prisma } = setupService();
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawal.findUnique.mockResolvedValue({ id: 'wd-1', status: 'paid' });
    const result = await service.markPaid('wd-1', 'admin-1');
    expect(prisma.withdrawal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wd-1', status: 'pending', deletedAt: null },
        data: expect.objectContaining({ status: 'paid', reviewedBy: 'admin-1' }),
      }),
    );
    expect(result).toEqual({ id: 'wd-1', status: 'paid' });
  });
});

describe('WithdrawalsService.reject - 驳回', () => {
  it('updateMany count=0 + 记录不存在 → NotFoundException', async () => {
    const { service, prisma } = setupService();
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(null);
    await expect(service.reject('wd-1', 'admin-1', '不符合')).rejects.toThrow(NotFoundException);
  });

  it('updateMany count=0 + 非 pending → BadRequestException', async () => {
    const { service, prisma } = setupService();
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue({ id: 'wd-1', status: 'rejected' });
    await expect(service.reject('wd-1', 'admin-1', '不符合')).rejects.toThrow(BadRequestException);
  });

  it('pending → rejected', async () => {
    const { service, prisma } = setupService();
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawal.findUnique.mockResolvedValue({ id: 'wd-1', status: 'rejected' });
    const result = await service.reject('wd-1', 'admin-1', '金额有误');
    expect(prisma.withdrawal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'rejected',
          reviewNote: '金额有误',
          reviewedBy: 'admin-1',
        }),
      }),
    );
    expect(result).toEqual({ id: 'wd-1', status: 'rejected' });
  });
});
