import { add2, sub2, mul2, min2, round2, clamp01d } from '../common/money';
import { resolveTierRatio } from './tier.util';

export type RefundPolicy = 'full' | 'tiered' | 'keep_commission';

export interface CommissionSnapshot {
  platformRate: number;
  refundPolicy: RefundPolicy;
  refundTiers: Record<string, number>;
  source: string;
  resolvedAt: string;
}

export { round2 };

/** 安全数字转换：NaN / undefined / null → 0，其他正常 round2 */
const safeAmount = (n: number | undefined | null): number => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

/** 常规结算分账（订单验收后）：平台佣金 + 师傅所得 */
export function splitNormal(amount: number, snap: CommissionSnapshot) {
  const amt = round2(safeAmount(amount));
  const platformFee = mul2(amt, snap.platformRate);
  return { platformFee, masterAmount: sub2(amt, platformFee) };
}

/** 退款分账（异常场景）：一次算清「退用户 / 平台留成 / 师傅补偿」三方。
 *  - full            ：忽略阶梯，退用户 100%，平台与师傅均无留成
 *  - tiered（默认）   ：按 refundTiers 留成，留成再按 platformRate 拆平台/师傅
 *  - keep_commission ：平台佣金始终不退，平台先保住佣金，余下留成给师傅
 */
export function splitRefund(amount: number, status: string, snap: CommissionSnapshot) {
  const amt = round2(safeAmount(amount));
  const tierRatio = resolveTierRatio(status, snap.refundTiers ?? {});

  let refundRatio = tierRatio;
  if (snap.refundPolicy === 'full') refundRatio = 1;
  else if (snap.refundPolicy === 'keep_commission')
    refundRatio = clamp01d(Math.min(tierRatio, 1 - snap.platformRate));

  const refundAmount = mul2(amt, refundRatio);
  const keep = sub2(amt, refundAmount);
  const fullCommission = mul2(amt, snap.platformRate);

  const platformKeep =
    snap.refundPolicy === 'keep_commission'
      ? min2(keep, fullCommission)
      : mul2(keep, snap.platformRate);

  return {
    refundRatio,
    refundAmount,
    platformKeep,
    masterCompensation: sub2(keep, platformKeep),
  };
}
