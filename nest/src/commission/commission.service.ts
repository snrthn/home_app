import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@laoma/shared';
import { CANCELLABLE_LIFECYCLE, clamp01, resolveTierRatio } from './tier.util';

/** 退款佣金策略（与 schema.prisma RefundPolicy 对齐） */
export type RefundPolicy = 'full' | 'tiered' | 'keep_commission';

/** 分账规则解析结果 / 订单快照结构（固化进 Order.commissionSnapshot） */
export interface CommissionSnapshot {
  /** 平台抽佣率 0~1（师傅得 1 - platformRate） */
  platformRate: number;
  /** 退款佣金策略 */
  refundPolicy: RefundPolicy;
  /** 阶梯退款比例：键为订单状态，值为退给用户的比例 0~1；缺省状态退全额 */
  refundTiers: Record<string, number>;
  /** 规则来源，便于审计与排查：service:<id> / category:<id> / global / default */
  source: string;
  /** 解析时间（ISO） */
  resolvedAt: string;
}

/** 兜底默认值 —— 必须与改造前的硬编码行为完全一致（platformRate=0 不抽佣、
 *  departing 退 80% / arrived 退 50%），保证未配置任何规则时零行为变更。 */
const DEFAULT_TIERS: Record<string, number> = {
  [OrderStatus.Departing]: 0.8,
  [OrderStatus.Arrived]: 0.5,
};

export const DEFAULT_SNAPSHOT: Omit<CommissionSnapshot, 'resolvedAt'> = {
  platformRate: 0,
  refundPolicy: 'tiered',
  refundTiers: DEFAULT_TIERS,
  source: 'default',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class CommissionService {
  constructor(private prisma: PrismaService) {}

  // ===================== 解析（三级降级） =====================

  /** 按「服务项 → 类目树（就近向上）→ 全局」优先级解析最终分账规则。
   *  越具体越优先；类目支持沿 parentId 向上继承（叶子无规则则用父类目的）。 */
  async resolve(serviceItemId: string): Promise<CommissionSnapshot> {
    const item = await this.prisma.serviceItem.findUnique({
      where: { id: serviceItemId },
      select: { id: true, categoryId: true },
    });

    // 类目链：从叶子类目向上收集（限深 10 防脏数据成环）
    const categoryChain: string[] = [];
    let cur = item?.categoryId ?? null;
    for (let i = 0; i < 10 && cur; i++) {
      categoryChain.push(cur);
      const c = await this.prisma.serviceCategory.findUnique({
        where: { id: cur },
        select: { parentId: true },
      });
      cur = c?.parentId ?? null;
    }

    // 一次性把候选规则全查出来，在内存里按优先级挑，避免逐级打库
    const rules = await this.prisma.commissionRule.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { scope: 'service', refId: serviceItemId },
          ...(categoryChain.length ? [{ scope: 'category' as const, refId: { in: categoryChain } }] : []),
          { scope: 'global' },
        ],
      },
    });

    const pick = (fn: (r: any) => boolean) => rules.find(fn);

    // 1) 服务项覆盖
    const svc = pick((r) => r.scope === 'service' && r.refId === serviceItemId);
    if (svc) return this.toSnapshot(svc, `service:${serviceItemId}`);

    // 2) 类目覆盖：按类目链顺序取最近命中的祖先
    for (const cid of categoryChain) {
      const cat = pick((r) => r.scope === 'category' && r.refId === cid);
      if (cat) return this.toSnapshot(cat, `category:${cid}`);
    }

    // 3) 全局兜底
    const glb = pick((r) => r.scope === 'global');
    if (glb) return this.toSnapshot(glb, 'global');

    // 4) 未配置任何规则 → 内置默认（等价改造前硬编码）
    return { ...DEFAULT_SNAPSHOT, resolvedAt: new Date().toISOString() };
  }

  /** 订单维度取规则：优先读下单时固化的快照；历史单（无快照）实时解析兜底。
   *  退款/结算全程走这里，保证「后期改配置不污染历史单」。 */
  async snapshotFromOrder(order: {
    serviceItemId: string;
    commissionSnapshot?: any;
  }): Promise<CommissionSnapshot> {
    const snap = this.normalizeSnapshot(order.commissionSnapshot);
    if (snap) return snap;
    return this.resolve(order.serviceItemId);
  }

  /** 把库里的规则行转成快照结构 */
  private toSnapshot(rule: any, source: string): CommissionSnapshot {
    return {
      platformRate: clamp01(Number(rule.platformRate ?? 0)),
      refundPolicy: (rule.refundPolicy ?? 'tiered') as RefundPolicy,
      refundTiers: this.normalizeTiers(rule.refundTiers) ?? DEFAULT_TIERS,
      source,
      resolvedAt: new Date().toISOString(),
    };
  }

  /** 校验并规整外部传入/库中存量的快照 JSON；不合法返回 null 以触发重新解析 */
  private normalizeSnapshot(raw: any): CommissionSnapshot | null {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.platformRate === undefined && raw.refundPolicy === undefined) return null;
    const policy: RefundPolicy = ['full', 'tiered', 'keep_commission'].includes(raw.refundPolicy)
      ? raw.refundPolicy
      : 'tiered';
    return {
      platformRate: clamp01(Number(raw.platformRate ?? 0)),
      refundPolicy: policy,
      refundTiers: this.normalizeTiers(raw.refundTiers) ?? DEFAULT_TIERS,
      source: typeof raw.source === 'string' ? raw.source : 'snapshot',
      resolvedAt: typeof raw.resolvedAt === 'string' ? raw.resolvedAt : new Date().toISOString(),
    };
  }

  /** 阶梯配置规整：仅保留合法订单状态键与 0~1 的比例值 */
  private normalizeTiers(raw: any): Record<string, number> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const valid = Object.values(OrderStatus) as string[];
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(v);
      if (!valid.includes(k) || Number.isNaN(n)) continue;
      out[k] = clamp01(n);
    }
    return Object.keys(out).length ? out : null;
  }

  // ===================== 分账计算 =====================

  /** 常规结算分账（订单验收后）：平台佣金 + 师傅所得 */
  splitNormal(amount: number, snap: CommissionSnapshot) {
    const amt = round2(Number(amount) || 0);
    const platformFee = round2(amt * snap.platformRate);
    return { platformFee, masterAmount: round2(amt - platformFee) };
  }

  /** 退款分账（异常场景，悖论#2 的落地）：一次算清「退用户 / 平台留成 / 师傅补偿」三方。
   *  - full            ：忽略阶梯，退用户 100%，平台与师傅均无留成
   *  - tiered（默认）   ：按 refundTiers 留成，留成再按 platformRate 拆平台/师傅
   *  - keep_commission ：平台佣金始终不退，平台先保住佣金，余下留成给师傅
   */
  splitRefund(amount: number, status: string, snap: CommissionSnapshot) {
    const amt = round2(Number(amount) || 0);
    // 区间语义：沿生命周期向前找最近断点，而非按状态直接查（缺省≠100%）
    const tierRatio = resolveTierRatio(status, snap.refundTiers ?? {});

    let refundRatio = tierRatio;
    if (snap.refundPolicy === 'full') refundRatio = 1;
    else if (snap.refundPolicy === 'keep_commission')
      refundRatio = clamp01(Math.min(tierRatio, 1 - snap.platformRate));

    const refundAmount = round2(amt * refundRatio);
    const keep = round2(amt - refundAmount); // 未退给用户的部分，由平台与师傅分
    const fullCommission = round2(amt * snap.platformRate);

    // keep_commission 下平台优先保住佣金；tiered 下留成按比例拆
    const platformKeep =
      snap.refundPolicy === 'keep_commission'
        ? round2(Math.min(keep, fullCommission))
        : round2(keep * snap.platformRate);

    return {
      refundRatio,
      refundAmount,
      platformKeep,
      masterCompensation: round2(keep - platformKeep),
    };
  }

  // ===================== 管理端 CRUD =====================

  /** 规则列表（附作用对象名称，便于台账可读） */
  async list() {
    const rules = await this.prisma.commissionRule.findMany({
      where: { deletedAt: null },
      orderBy: [{ scope: 'asc' }, { createdAt: 'desc' }],
    });
    const catIds = rules.filter((r) => r.scope === 'category').map((r) => r.refId);
    const svcIds = rules.filter((r) => r.scope === 'service').map((r) => r.refId);
    const [cats, svcs] = await Promise.all([
      catIds.length
        ? this.prisma.serviceCategory.findMany({
            where: { id: { in: catIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      svcIds.length
        ? this.prisma.serviceItem.findMany({
            where: { id: { in: svcIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const nameMap = new Map<string, string>([
      ...cats.map((c) => [c.id, c.name] as [string, string]),
      ...svcs.map((s) => [s.id, s.name] as [string, string]),
    ]);
    return rules.map((r) => ({
      ...r,
      platformRate: Number(r.platformRate),
      refName: r.scope === 'global' ? '全平台默认' : (nameMap.get(r.refId) ?? '（已删除）'),
    }));
  }

  /** 新增/更新规则（scope + refId 唯一，故用 upsert 语义） */
  async upsert(dto: {
    scope: 'global' | 'category' | 'service';
    refId?: string;
    platformRate: number;
    refundPolicy: RefundPolicy;
    refundTiers?: Record<string, number> | null;
    isActive?: boolean;
    note?: string;
  }) {
    const refId = dto.scope === 'global' ? '' : (dto.refId ?? '').trim();
    if (dto.scope !== 'global' && !refId)
      throw new BadRequestException('请选择规则作用的类目或服务项');
    const rate = Number(dto.platformRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 1)
      throw new BadRequestException('平台佣金率需在 0~1 之间');

    // 作用对象存在性校验，避免配出悬空规则
    if (dto.scope === 'category') {
      const c = await this.prisma.serviceCategory.findFirst({
        where: { id: refId, deletedAt: null },
      });
      if (!c) throw new NotFoundException('类目不存在');
    } else if (dto.scope === 'service') {
      const s = await this.prisma.serviceItem.findFirst({
        where: { id: refId, deletedAt: null },
      });
      if (!s) throw new NotFoundException('服务项不存在');
    }

    const tiers = this.normalizeTiers(dto.refundTiers) ?? DEFAULT_TIERS;
    const data = {
      platformRate: rate,
      refundPolicy: dto.refundPolicy ?? 'tiered',
      refundTiers: tiers as any,
      isActive: dto.isActive ?? true,
      note: dto.note?.trim() || null,
      deletedAt: null, // 命中软删旧行时一并复活，避免唯一键冲突
    };
    return this.prisma.commissionRule.upsert({
      where: { scope_refId: { scope: dto.scope, refId } },
      create: { scope: dto.scope, refId, ...data },
      update: data,
    });
  }

  /** 软删规则（全局规则不允许删，只允许改，避免解析链断底） */
  async remove(id: string) {
    const r = await this.prisma.commissionRule.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('规则不存在');
    if (r.scope === 'global')
      throw new BadRequestException('全局默认规则不可删除，请直接修改其比例');
    return this.prisma.commissionRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** 配置页试算：给定服务项，预览最终生效规则与各阶段退款分账结果 */
  async preview(serviceItemId: string, amount = 100) {
    const snap = await this.resolve(serviceItemId);
    const normal = this.splitNormal(amount, snap);
    return {
      snapshot: snap,
      normal,
      refunds: CANCELLABLE_LIFECYCLE.map((s) => {
        const resolvedRatio = resolveTierRatio(s, snap.refundTiers ?? {});
        return { status: s, resolvedRatio, ...this.splitRefund(amount, s, snap) };
      }),
    };
  }
}
