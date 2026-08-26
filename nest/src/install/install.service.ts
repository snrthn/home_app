import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/* eslint-disable @typescript-eslint/no-require-imports */
const { seedPermissions } = require('../../prisma/seed.js') as {
  seedPermissions: (prisma: PrismaService) => Promise<void>;
};
const { seedCategories } = require('../../prisma/seed-categories.js') as {
  seedCategories: (prisma: PrismaService) => Promise<void>;
};
const { seedItems } = require('../../prisma/seed-items.js') as {
  seedItems: (prisma: PrismaService) => Promise<void>;
};
const { seedContent } = require('../../prisma/seed-content.js') as {
  seedContent: (prisma: PrismaService) => Promise<void>;
};
const { initAdmin } = require('../../scripts/init-admin.cjs') as {
  initAdmin: (prisma: PrismaService, phone: string, password: string, nickname: string) => Promise<void>;
};
/* eslint-enable @typescript-eslint/no-require-imports */

@Injectable()
export class InstallService {
  private cachedInstalled: boolean | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL = 10_000;

  constructor(private readonly prisma: PrismaService) {}

  async isInstalled(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedInstalled !== null && now - this.cacheTime < this.CACHE_TTL) {
      return this.cachedInstalled;
    }
    try {
      const row = await this.prisma.systemConfig.findUnique({ where: { id: 1 } });
      this.cachedInstalled = row?.installed ?? false;
      this.cacheTime = now;
    } catch {
      this.cachedInstalled = false;
    }
    return this.cachedInstalled;
  }

  async getStatus() {
    const row = await this.prisma.systemConfig.findUnique({ where: { id: 1 } });
    return {
      installed: row?.installed ?? false,
      installedAt: row?.installedAt ?? null,
    };
  }

  invalidateCache() {
    this.cachedInstalled = null;
  }

  async init(phone: string, password: string, nickname: string) {
    if (await this.isInstalled()) {
      throw new Error('系统已安装，如需重新初始化请先重置');
    }

    await this.prisma.systemConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, siteName: '老马家电', smsMode: 'mock' },
    });

    await seedPermissions(this.prisma);
    await seedCategories(this.prisma);
    await seedItems(this.prisma);
    await seedContent(this.prisma);
    await initAdmin(this.prisma, phone, password, nickname);

    await this.prisma.systemConfig.update({
      where: { id: 1 },
      data: { installed: true, installedAt: new Date() },
    });

    this.invalidateCache();
  }

  async reset(mode: 'light' | 'deep' = 'light') {
    if (mode === 'deep') {
      await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
      const tables = [
        'orderlog', 'payment', 'quotation', 'settlement', 'withdrawal',
        'review', 'notification', 'agreementversion', 'agreementtemplate',
        'notice', 'sitecontent', 'serviceitem', 'servicecategory',
        'servicearea', 'address', 'order', 'ticketcomment', 'ticket',
        'complaint', 'refund', 'operationlog', 'staffrolepermission',
        'permission', 'staffrole', 'master', 'userprofile', 'user',
        'merchantconfig', 'paymentqr',
      ];
      for (const table of tables) {
        await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
      }
      await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    }

    await this.prisma.systemConfig.upsert({
      where: { id: 1 },
      update: { installed: false, installedAt: null },
      create: { id: 1, installed: false, installedAt: null, siteName: '老马家电', smsMode: 'mock' },
    });

    this.invalidateCache();
  }
}
