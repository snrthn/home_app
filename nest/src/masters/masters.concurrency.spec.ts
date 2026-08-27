import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MastersService } from './masters.service';
import { createMockPrisma } from '../test/mocks';

const MASTER_ID = 'master-1';

function setup(opts?: { master?: any; updateManyResult?: { count: number } }) {
  const prisma = createMockPrisma();
  prisma.master.findUnique.mockResolvedValue(opts?.master ?? {
    id: MASTER_ID,
    status: 'pending',
    realName: '张三',
    idVerified: false,
  });
  prisma.master.updateMany.mockResolvedValue(opts?.updateManyResult ?? { count: 1 });
  const service = new MastersService(prisma);
  return { service, prisma };
}

describe('MastersService 审核乐观锁', () => {
  it('正常审核通过：pending → active', async () => {
    const { service, prisma } = setup({
      master: { id: MASTER_ID, status: 'pending' },
      updateManyResult: { count: 1 },
    });
    const result = await service.approve(MASTER_ID, 'active');
    expect(prisma.master.updateMany).toHaveBeenCalledWith({
      where: { id: MASTER_ID, status: 'pending' },
      data: expect.objectContaining({ status: 'active', idVerified: true }),
    });
    expect(result).toEqual(expect.objectContaining({ id: MASTER_ID }));
  });

  it('正常驳回：pending → disabled', async () => {
    const { service, prisma } = setup({
      master: { id: MASTER_ID, status: 'pending' },
      updateManyResult: { count: 1 },
    });
    await service.approve(MASTER_ID, 'disabled', '资料不符');
    expect(prisma.master.updateMany).toHaveBeenCalledWith({
      where: { id: MASTER_ID, status: 'pending' },
      data: expect.objectContaining({ status: 'disabled', rejectReason: '资料不符' }),
    });
  });

  it('并发审核：count=0 → BadRequestException', async () => {
    const { service, prisma } = setup({
      master: { id: MASTER_ID, status: 'active' },
      updateManyResult: { count: 0 },
    });
    await expect(service.approve(MASTER_ID, 'active')).rejects.toThrow(BadRequestException);
  });

  it('师傅不存在 → NotFoundException', async () => {
    const { service, prisma } = setup({ master: null, updateManyResult: { count: 0 } });
    prisma.master.findUnique.mockResolvedValue(null);
    await expect(service.approve(MASTER_ID, 'active')).rejects.toThrow(NotFoundException);
  });

  it('setStatus 正常：active → disabled', async () => {
    const { service, prisma } = setup({
      master: { id: MASTER_ID, status: 'active' },
      updateManyResult: { count: 1 },
    });
    await service.setStatus(MASTER_ID, 'disabled');
    expect(prisma.master.updateMany).toHaveBeenCalledWith({
      where: { id: MASTER_ID, status: { in: ['active', 'disabled'] } },
      data: { status: 'disabled' },
    });
  });

  it('setStatus 并发：count=0 → BadRequestException', async () => {
    const { service, prisma } = setup({
      master: { id: MASTER_ID, status: 'pending' },
      updateManyResult: { count: 0 },
    });
    await expect(service.setStatus(MASTER_ID, 'disabled')).rejects.toThrow(BadRequestException);
  });
});
