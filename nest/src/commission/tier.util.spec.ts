import { CANCELLABLE_LIFECYCLE, clamp01, resolveTierRatio } from './tier.util';

// 直接用 util 暴露的生命周期实际值作为 tiers 的 key，避免依赖 OrderStatus 的字面量表示。
const [pendingAccept, accepted, departing, arrived, servicing, pendingConfirm] =
  CANCELLABLE_LIFECYCLE;

describe('resolveTierRatio - 区间继承语义', () => {
  it('非可取消状态 → 兜底全额退(1)', () => {
    expect(resolveTierRatio('COMPLETED', { [departing]: 0.8 })).toBe(1);
    expect(resolveTierRatio('some_unknown_status', {})).toBe(1);
  });

  it('状态有显式断点 → 返回该断点值', () => {
    expect(resolveTierRatio(departing, { [departing]: 0.8 })).toBe(0.8);
    expect(resolveTierRatio(arrived, { [arrived]: 0.5 })).toBe(0.5);
  });

  it('状态无断点但之前有断点 → 继承最近的上一个断点（区间语义）', () => {
    // 只配了 departing=0.8，其后所有状态都应继承 0.8
    const tiers = { [departing]: 0.8 };
    expect(resolveTierRatio(arrived, tiers)).toBe(0.8);
    expect(resolveTierRatio(servicing, tiers)).toBe(0.8);
    expect(resolveTierRatio(pendingConfirm, tiers)).toBe(0.8);
  });

  it('状态之前无任何断点 → 全额退(1)', () => {
    // 只配了 arrived=0.5，departing 在 arrived 之前，无更早断点 → 1
    const tiers = { [arrived]: 0.5 };
    expect(resolveTierRatio(departing, tiers)).toBe(1);
    expect(resolveTierRatio(pendingAccept, tiers)).toBe(1);
  });

  it('最近的断点优先（而非最早的）', () => {
    const tiers = { [departing]: 0.8, [arrived]: 0.5 };
    expect(resolveTierRatio(departing, tiers)).toBe(0.8);
    expect(resolveTierRatio(arrived, tiers)).toBe(0.5);
    expect(resolveTierRatio(servicing, tiers)).toBe(0.5); // 继承 arrived
    expect(resolveTierRatio(pendingConfirm, tiers)).toBe(0.5);
  });

  it('空 tiers → 任意可取消状态全额退(1)', () => {
    expect(resolveTierRatio(departing, {})).toBe(1);
    expect(resolveTierRatio(pendingConfirm, {})).toBe(1);
  });

  it('clamp01：断点值越界被夹到 [0,1]', () => {
    expect(resolveTierRatio(departing, { [departing]: 1.5 })).toBe(1);
    expect(resolveTierRatio(departing, { [departing]: -0.3 })).toBe(0);
  });
});

describe('clamp01', () => {
  it('夹到 [0,1]', () => {
    expect(clamp01(1.2)).toBe(1);
    expect(clamp01(-0.1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
  });
});
