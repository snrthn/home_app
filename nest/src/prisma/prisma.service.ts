import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// pnpm 的 @prisma/client 是只读软链，生成客户端实际位于 node_modules/.prisma/client
import { PrismaClient } from '../../node_modules/.prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
