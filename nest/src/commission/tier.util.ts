import { OrderStatus } from '@laoma/shared';

/** 可取消状态的生命周期顺序（支付后 → 终态前），用于区间解析：
 *  refundTiers 的语义是「从该状态起，退 X%」，后续未定义状态继承上一个断点的值，
 *  直到遇到下一个断点。这样运营只需配 3~4 个断点而非每个状态都设。
 *  与 @laoma/shared 的 OrderStatus 可取消子集保持一致（值相同）。 */
export const CANCELLABLE_LIFECYCLE = [
  OrderStatus.PendingAccept,
  OrderStatus.Accepted,
  OrderStatus.Departing,
  OrderStatus.Arrived,
  OrderStatus.Servicing,
  OrderStatus.PendingConfirm,
];

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 区间解析：给定当前状态，沿生命周期向前找最近一个已定义的退款断点；
 *  找不到则默认全额退（1）。 */
export function resolveTierRatio(status: string, tiers: Record<string, number>): number {
  const idx = CANCELLABLE_LIFECYCLE.indexOf(status as OrderStatus);
  if (idx < 0) return 1; // 非可取消状态，兜底全额
  for (let i = idx; i >= 0; i--) {
    const key = CANCELLABLE_LIFECYCLE[i];
    if (key in tiers) return clamp01(tiers[key]);
  }
  return 1; // 该状态之前无断点 → 全额退
}
