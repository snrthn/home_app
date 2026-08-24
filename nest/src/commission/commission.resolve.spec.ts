import { CommissionService } from './commission.service';
import { createMockPrisma } from '../test/mocks';
import { OrderStatus } from '@laoma/shared';

const ITEM_ID = 'item-1';
const CAT_LEAF = 'cat-leaf';
const CAT_PARENT = 'cat-parent';
const CAT_GRAND = 'cat-grand';

function makeRule(overrides: Record<string, any> = {}) {
  return {
    id: 'rule-1',
    scope: 'global',
    refId: null,
    platformRate: 0.1,
    refundPolicy: 'tiered',
    refundTiers: { [OrderStatus.Departing]: 0.8, [OrderStatus.Arrived]: 0.5 },
    isActive: true,
    deletedAt: null,
    ...overrides,
  };
}

function setupService(opts?: {
  item?: any;
  categoryMap?: Record<string, { parentId: string | null }>;
  rules?: any[];
}) {
  const prisma = createMockPrisma();

  prisma.serviceItem.findUnique.mockResolvedValue(
    opts?.item ?? { id: ITEM_ID, categoryId: CAT_LEAF },
  );

  const categoryMap = opts?.categoryMap ?? {
    [CAT_LEAF]: { parentId: CAT_PARENT },
    [CAT_PARENT]: { parentId: CAT_GRAND },
    [CAT_GRAND]: { parentId: null },
  };

  prisma.serviceCategory.findUnique.mockImplementation(async ({ where: { id } }: any) => {
    return categoryMap[id] ?? null;
  });

  prisma.commissionRule.findMany.mockResolvedValue(opts?.rules ?? []);

  const service = new CommissionService(prisma);
  return { service, prisma };
}

describe('CommissionService.resolve - 三级降级', () => {
  describe('1) 服务项命中（最高优先级）', () => {
    it('scope=service 规则存在 → source=service:<id>', async () => {
      const { service } = setupService({
        rules: [
          makeRule({ id: 'r-svc', scope: 'service', refId: ITEM_ID, platformRate: 0.15 }),
          makeRule({ id: 'r-cat', scope: 'category', refId: CAT_LEAF, platformRate: 0.1 }),
          makeRule({ id: 'r-glb', scope: 'global', platformRate: 0.05 }),
        ],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.source).toBe(`service:${ITEM_ID}`);
      expect(snap.platformRate).toBe(0.15);
    });
  });

  describe('2) 类目命中（沿链向上）', () => {
    it('叶子类目有规则 → source=category:<leaf>', async () => {
      const { service } = setupService({
        rules: [
          makeRule({ id: 'r-cat', scope: 'category', refId: CAT_LEAF, platformRate: 0.1 }),
          makeRule({ id: 'r-glb', scope: 'global', platformRate: 0.05 }),
        ],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.source).toBe(`category:${CAT_LEAF}`);
      expect(snap.platformRate).toBe(0.1);
    });

    it('叶子无规则，父类目有规则 → 继承父', async () => {
      const { service } = setupService({
        rules: [
          makeRule({ id: 'r-par', scope: 'category', refId: CAT_PARENT, platformRate: 0.12 }),
          makeRule({ id: 'r-glb', scope: 'global', platformRate: 0.05 }),
        ],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.source).toBe(`category:${CAT_PARENT}`);
      expect(snap.platformRate).toBe(0.12);
    });

    it('叶子和父均无规则，祖父有规则 → 继承祖父', async () => {
      const { service } = setupService({
        rules: [
          makeRule({ id: 'r-grd', scope: 'category', refId: CAT_GRAND, platformRate: 0.08 }),
          makeRule({ id: 'r-glb', scope: 'global', platformRate: 0.05 }),
        ],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.source).toBe(`category:${CAT_GRAND}`);
      expect(snap.platformRate).toBe(0.08);
    });
  });

  describe('3) 全局兜底', () => {
    it('无 service/category 规则，有 global → source=global', async () => {
      const { service } = setupService({
        rules: [
          makeRule({ id: 'r-glb', scope: 'global', platformRate: 0.05 }),
        ],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.source).toBe('global');
      expect(snap.platformRate).toBe(0.05);
    });
  });

  describe('4) 无任何规则 → DEFAULT_SNAPSHOT', () => {
    it('空规则集 → source=default, platformRate=0', async () => {
      const { service } = setupService({ rules: [] });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.source).toBe('default');
      expect(snap.platformRate).toBe(0);
      expect(snap.refundPolicy).toBe('tiered');
      // 默认阶梯: departing 0.8, arrived 0.5
      expect(snap.refundTiers[OrderStatus.Departing]).toBe(0.8);
      expect(snap.refundTiers[OrderStatus.Arrived]).toBe(0.5);
    });
  });

  describe('优先级', () => {
    it('service + category + global 同时存在 → service 胜出', async () => {
      const { service } = setupService({
        rules: [
          makeRule({ scope: 'service', refId: ITEM_ID, platformRate: 0.2 }),
          makeRule({ scope: 'category', refId: CAT_LEAF, platformRate: 0.15 }),
          makeRule({ scope: 'global', platformRate: 0.1 }),
        ],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.source).toBe(`service:${ITEM_ID}`);
    });

    it('category + global 同时存在 → category 胜出', async () => {
      const { service } = setupService({
        rules: [
          makeRule({ scope: 'category', refId: CAT_LEAF, platformRate: 0.15 }),
          makeRule({ scope: 'global', platformRate: 0.1 }),
        ],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.source).toBe(`category:${CAT_LEAF}`);
    });
  });

  describe('类目链深度限制', () => {
    it('超过 10 层 → 截断不报错', async () => {
      // 构建 12 层链
      const deepMap: Record<string, { parentId: string | null }> = {};
      for (let i = 0; i < 12; i++) {
        deepMap[`cat-${i}`] = { parentId: i < 11 ? `cat-${i + 1}` : null };
      }
      const { service, prisma } = setupService({
        item: { id: ITEM_ID, categoryId: 'cat-0' },
        categoryMap: deepMap,
        rules: [],
      });
      const snap = await service.resolve(ITEM_ID);
      // 应截断到 10 层，不报错，走 default
      expect(snap.source).toBe('default');
      // serviceCategory.findUnique 最多调用 10 次
      expect(prisma.serviceCategory.findUnique).toHaveBeenCalledTimes(10);
    });
  });

  describe('toSnapshot 规整', () => {
    it('platformRate 越界 → clamp01（1.5 → 1）', async () => {
      const { service } = setupService({
        rules: [makeRule({ scope: 'global', platformRate: 1.5 })],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.platformRate).toBe(1);
    });

    it('platformRate 负数 → clamp01（-0.3 → 0）', async () => {
      const { service } = setupService({
        rules: [makeRule({ scope: 'global', platformRate: -0.3 })],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.platformRate).toBe(0);
    });

    it('refundPolicy 非法值 → 原样透传（toSnapshot 仅 null 兜底，不做枚举校验）', async () => {
      const { service } = setupService({
        rules: [makeRule({ scope: 'global', refundPolicy: 'invalid_policy' })],
      });
      const snap = await service.resolve(ITEM_ID);
      // toSnapshot 用 ?? 'tiered'，只兜底 null/undefined，非法字符串原样透传
      expect(snap.refundPolicy).toBe('invalid_policy');
    });

    it('refundPolicy null → 默认 tiered', async () => {
      const { service } = setupService({
        rules: [makeRule({ scope: 'global', refundPolicy: null })],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.refundPolicy).toBe('tiered');
    });

    it('refundTiers 非法键 → 过滤', async () => {
      const { service } = setupService({
        rules: [makeRule({
          scope: 'global',
          refundTiers: { invalid_key: 0.5, [OrderStatus.Departing]: 0.8, bad: 'not_number' },
        })],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.refundTiers[OrderStatus.Departing]).toBe(0.8);
      expect(snap.refundTiers['invalid_key']).toBeUndefined();
      expect(snap.refundTiers['bad']).toBeUndefined();
    });

    it('refundTiers 空对象 → 回退 DEFAULT_TIERS', async () => {
      const { service } = setupService({
        rules: [makeRule({ scope: 'global', refundTiers: {} })],
      });
      const snap = await service.resolve(ITEM_ID);
      expect(snap.refundTiers[OrderStatus.Departing]).toBe(0.8);
      expect(snap.refundTiers[OrderStatus.Arrived]).toBe(0.5);
    });
  });

  describe('snapshotFromOrder - 订单维度取规则', () => {
    it('有快照 → 直接使用快照', async () => {
      const { service, prisma } = setupService({ rules: [] });
      const order = {
        serviceItemId: ITEM_ID,
        commissionSnapshot: {
          platformRate: 0.12,
          refundPolicy: 'tiered',
          refundTiers: { [OrderStatus.Departing]: 0.7 },
          source: 'service:old',
          resolvedAt: '2026-01-01T00:00:00.000Z',
        },
      };
      const snap = await service.snapshotFromOrder(order);
      expect(snap.platformRate).toBe(0.12);
      expect(snap.source).toBe('service:old');
      // 不应触发 resolve（不查库）
      expect(prisma.serviceItem.findUnique).not.toHaveBeenCalled();
    });

    it('无快照 → 实时 resolve 兜底', async () => {
      const { service, prisma } = setupService({
        rules: [makeRule({ scope: 'global', platformRate: 0.05 })],
      });
      const order = { serviceItemId: ITEM_ID, commissionSnapshot: null };
      const snap = await service.snapshotFromOrder(order);
      expect(snap.source).toBe('global');
      expect(prisma.serviceItem.findUnique).toHaveBeenCalled();
    });

    it('快照不合法（缺关键字段）→ 实时 resolve 兜底', async () => {
      const { service, prisma } = setupService({
        rules: [makeRule({ scope: 'global', platformRate: 0.05 })],
      });
      const order = { serviceItemId: ITEM_ID, commissionSnapshot: { foo: 'bar' } };
      const snap = await service.snapshotFromOrder(order);
      expect(snap.source).toBe('global');
      expect(prisma.serviceItem.findUnique).toHaveBeenCalled();
    });

    it('快照 platformRate 越界 → clamp01', async () => {
      const { service } = setupService({ rules: [] });
      const order = {
        serviceItemId: ITEM_ID,
        commissionSnapshot: {
          platformRate: 2.5,
          refundPolicy: 'tiered',
          source: 'snapshot',
          resolvedAt: '2026-01-01T00:00:00.000Z',
        },
      };
      const snap = await service.snapshotFromOrder(order);
      expect(snap.platformRate).toBe(1);
    });
  });
});
