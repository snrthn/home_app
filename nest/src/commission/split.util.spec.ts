import { splitNormal, splitRefund, round2, type CommissionSnapshot } from './split.util';
import { OrderStatus } from '@laoma/shared';

const snap = (overrides: Partial<CommissionSnapshot> = {}): CommissionSnapshot => ({
  platformRate: 0,
  refundPolicy: 'tiered',
  refundTiers: { [OrderStatus.Departing]: 0.8, [OrderStatus.Arrived]: 0.5 },
  source: 'default',
  resolvedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('round2', () => {
  it('两位精度', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(3.14159)).toBe(3.14);
  });
});

describe('splitNormal - 常规分账', () => {
  it('平台费率 0 → 全归师傅', () => {
    const r = splitNormal(100, snap({ platformRate: 0 }));
    expect(r.platformFee).toBe(0);
    expect(r.masterAmount).toBe(100);
  });

  it('平台费率 0.1 → 10/90 分', () => {
    const r = splitNormal(100, snap({ platformRate: 0.1 }));
    expect(r.platformFee).toBe(10);
    expect(r.masterAmount).toBe(90);
  });

  it('平台费率 0.5 → 50/50 分', () => {
    const r = splitNormal(100, snap({ platformRate: 0.5 }));
    expect(r.platformFee).toBe(50);
    expect(r.masterAmount).toBe(50);
  });

  it('平台费率 1 → 全归平台', () => {
    const r = splitNormal(100, snap({ platformRate: 1 }));
    expect(r.platformFee).toBe(100);
    expect(r.masterAmount).toBe(0);
  });

  it('金额 0 → 全 0', () => {
    const r = splitNormal(0, snap({ platformRate: 0.1 }));
    expect(r.platformFee).toBe(0);
    expect(r.masterAmount).toBe(0);
  });

  it('负数金额 → 原样传递（Number(-50)||0 = -50，非 falsy 不兜底）', () => {
    const r = splitNormal(-50, snap({ platformRate: 0.1 }));
    expect(r.platformFee).toBe(-5);
    expect(r.masterAmount).toBe(-45);
  });

  it('NaN 金额 → 按 0 处理', () => {
    const r = splitNormal(NaN, snap({ platformRate: 0.1 }));
    expect(r.platformFee).toBe(0);
    expect(r.masterAmount).toBe(0);
  });

  it('round2 精度（非整数金额）', () => {
    const r = splitNormal(99.99, snap({ platformRate: 0.1 }));
    expect(r.platformFee).toBe(10);
    expect(r.masterAmount).toBe(89.99);
  });
});

describe('splitRefund - 退款分账', () => {
  describe('full 策略（退用户 100%）', () => {
    it('忽略阶梯，全退', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'full' });
      const r = splitRefund(100, OrderStatus.Departing, s);
      expect(r.refundRatio).toBe(1);
      expect(r.refundAmount).toBe(100);
      expect(r.platformKeep).toBe(0);
      expect(r.masterCompensation).toBe(0);
    });
  });

  describe('tiered 策略（按阶梯留成）', () => {
    it('departing 阶梯 0.8 → 退 80%', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'tiered' });
      const r = splitRefund(100, OrderStatus.Departing, s);
      expect(r.refundRatio).toBe(0.8);
      expect(r.refundAmount).toBe(80);
      // keep=20, platformKeep=20*0.1=2, masterCompensation=18
      expect(r.platformKeep).toBe(2);
      expect(r.masterCompensation).toBe(18);
    });

    it('arrived 阶梯 0.5 → 退 50%', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'tiered' });
      const r = splitRefund(100, OrderStatus.Arrived, s);
      expect(r.refundRatio).toBe(0.5);
      expect(r.refundAmount).toBe(50);
      // keep=50, platformKeep=50*0.1=5, masterCompensation=45
      expect(r.platformKeep).toBe(5);
      expect(r.masterCompensation).toBe(45);
    });

    it('继承最近断点（servicing 继承 arrived 0.5）', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'tiered' });
      const r = splitRefund(100, OrderStatus.Servicing, s);
      expect(r.refundRatio).toBe(0.5);
    });

    it('断点之前的状态 → 全额退（1）', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'tiered' });
      const r = splitRefund(100, OrderStatus.PendingAccept, s);
      expect(r.refundRatio).toBe(1);
      expect(r.refundAmount).toBe(100);
    });

    it('非可取消状态 → 兜底全额退', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'tiered' });
      const r = splitRefund(100, OrderStatus.PendingPayment, s);
      expect(r.refundRatio).toBe(1);
    });

    it('空 tiers → 全额退', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'tiered', refundTiers: {} });
      const r = splitRefund(100, OrderStatus.Departing, s);
      expect(r.refundRatio).toBe(1);
      expect(r.refundAmount).toBe(100);
    });

    it('平台费率 0 → 无平台留成', () => {
      const s = snap({ platformRate: 0, refundPolicy: 'tiered' });
      const r = splitRefund(100, OrderStatus.Departing, s);
      expect(r.refundAmount).toBe(80);
      expect(r.platformKeep).toBe(0);
      expect(r.masterCompensation).toBe(20);
    });
  });

  describe('keep_commission 策略（平台佣金不退）', () => {
    it('平台先保住佣金', () => {
      const s = snap({ platformRate: 0.2, refundPolicy: 'keep_commission' });
      // tierRatio=0.8 (departing), refundRatio=min(0.8, 1-0.2)=0.8
      // refundAmount=80, keep=20, fullCommission=20
      // platformKeep=min(20,20)=20, masterCompensation=0
      const r = splitRefund(100, OrderStatus.Departing, s);
      expect(r.refundRatio).toBe(0.8);
      expect(r.refundAmount).toBe(80);
      expect(r.platformKeep).toBe(20);
      expect(r.masterCompensation).toBe(0);
    });

    it('佣金大于留成 → 平台只拿留成', () => {
      const s = snap({ platformRate: 0.5, refundPolicy: 'keep_commission' });
      // tierRatio=0.5 (arrived), refundRatio=min(0.5, 1-0.5)=0.5
      // refundAmount=50, keep=50, fullCommission=50
      // platformKeep=min(50,50)=50, masterCompensation=0
      const r = splitRefund(100, OrderStatus.Arrived, s);
      expect(r.refundAmount).toBe(50);
      expect(r.platformKeep).toBe(50);
      expect(r.masterCompensation).toBe(0);
    });

    it('留成大于佣金 → 师傅有补偿', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'keep_commission' });
      // tierRatio=0.5 (arrived), refundRatio=min(0.5, 1-0.1)=0.5
      // refundAmount=50, keep=50, fullCommission=10
      // platformKeep=min(50,10)=10, masterCompensation=40
      const r = splitRefund(100, OrderStatus.Arrived, s);
      expect(r.refundAmount).toBe(50);
      expect(r.platformKeep).toBe(10);
      expect(r.masterCompensation).toBe(40);
    });
  });

  describe('金额边界', () => {
    it('金额 0 → 全 0', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'tiered' });
      const r = splitRefund(0, OrderStatus.Departing, s);
      expect(r.refundAmount).toBe(0);
      expect(r.platformKeep).toBe(0);
      expect(r.masterCompensation).toBe(0);
    });

    it('负数金额 → 原样传递（非 falsy 不兜底）', () => {
      const s = snap({ platformRate: 0.1, refundPolicy: 'tiered' });
      const r = splitRefund(-100, OrderStatus.Departing, s);
      expect(r.refundAmount).toBe(-80);
    });
  });
});
