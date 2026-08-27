import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';

function createMockSysConfig(smsMode: 'mock' | 'real' = 'mock') {
  return {
    getGlobal: jest.fn().mockResolvedValue({ smsMode }),
  } as any;
}

function createMockJwt() {
  return {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn(),
  } as any;
}

function createMockConfig() {
  return {
    get: jest.fn().mockReturnValue('secret'),
  } as any;
}

function createMockGateway() {
  return { notifyDashboardRefresh: jest.fn() } as any;
}

function setupAuth(opts?: {
  user?: any;
  smsMode?: 'mock' | 'real';
  smsCodeRecord?: any;
}) {
  const prisma = createMockPrismaForAuth();
  const sysConfig = createMockSysConfig(opts?.smsMode ?? 'mock');
  const jwt = createMockJwt();
  const config = createMockConfig();
  const gateway = createMockGateway();

  prisma.user.findUnique.mockResolvedValue(opts?.user ?? null);
  prisma.smsCode.findFirst.mockResolvedValue(opts?.smsCodeRecord ?? null);

  const service = new AuthService(prisma, jwt, config, gateway, sysConfig);
  return { service, prisma, sysConfig, jwt, config, gateway };
}

function createMockPrismaForAuth() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    smsCode: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userProfile: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;
}

describe('AuthService', () => {
  describe('SMS per-phone 限流', () => {
    it('首次发送验证码成功（mock 模式）', async () => {
      const { service } = setupAuth();
      const result = await service.sendSmsCode('13800138000');
      expect(result.ok).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.dev).toBe(true);
    });

    it('60 秒内重复发送 → BadRequestException', async () => {
      const { service } = setupAuth();
      await service.sendSmsCode('13800138000');
      await expect(service.sendSmsCode('13800138000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('不同手机号互不影响', async () => {
      const { service } = setupAuth();
      await service.sendSmsCode('13800138000');
      const result = await service.sendSmsCode('13900139000');
      expect(result.ok).toBe(true);
    });
  });

  describe('登录失败锁定', () => {
    const userId = 'user-1';
    const phone = '13800138000';

    function makeUser(overrides: Record<string, any> = {}) {
      return {
        id: userId,
        phone,
        role: 'admin',
        passwordHash: bcrypt.hashSync('pass123', 10),
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...overrides,
      };
    }

    it('密码错误：失败次数 +1', async () => {
      const { service, prisma } = setupAuth({
        user: makeUser({ failedLoginAttempts: 0 }),
      });
      await expect(
        service.adminLogin(phone, 'wrongpass'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { failedLoginAttempts: 1 },
      });
    });

    it('连续 5 次失败 → 账号锁定 15 分钟', async () => {
      const { service, prisma } = setupAuth({
        user: makeUser({ failedLoginAttempts: 4 }),
      });
      await expect(
        service.adminLogin(phone, 'wrongpass'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: expect.any(Date),
        },
      });
    });

    it('已锁定账号 → 登录被拒', async () => {
      const lockTime = new Date(Date.now() + 10 * 60 * 1000);
      const { service } = setupAuth({
        user: makeUser({ lockedUntil: lockTime }),
      });
      await expect(
        service.adminLogin(phone, 'pass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('锁定过期后可正常登录', async () => {
      const expiredLock = new Date(Date.now() - 5 * 60 * 1000);
      const { service, prisma } = setupAuth({
        user: makeUser({ lockedUntil: expiredLock, failedLoginAttempts: 0 }),
      });
      prisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ lockedUntil: expiredLock, failedLoginAttempts: 0 }),
      );
      // issueTokens 调用
      prisma.user.update.mockResolvedValue(makeUser());
      prisma.user.findUnique
        .mockResolvedValueOnce(makeUser({ lockedUntil: expiredLock, failedLoginAttempts: 0 }))
        .mockResolvedValueOnce({
          id: userId,
          staffRoleId: null,
          staffRole: null,
        });
      const result = await service.adminLogin(phone, 'pass123');
      expect(result).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    it('登录成功 → 清空失败计数', async () => {
      const { service, prisma } = setupAuth({
        user: makeUser({ failedLoginAttempts: 3 }),
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(makeUser({ failedLoginAttempts: 3 }))
        .mockResolvedValueOnce({
          id: userId,
          staffRoleId: null,
          staffRole: null,
        });
      await service.adminLogin(phone, 'pass123');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    it('loginByPassword 同样受锁定保护', async () => {
      const lockTime = new Date(Date.now() + 10 * 60 * 1000);
      const { service } = setupAuth({
        user: makeUser({ role: 'customer', lockedUntil: lockTime }),
      });
      await expect(
        service.loginByPassword(phone, 'pass123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
