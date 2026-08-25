import Decimal from 'decimal.js';

/** 安全数字转换：NaN / Infinity / undefined / null → 0 */
const safeNum = (n: number | Decimal | undefined | null): number => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

/** 四舍五入到 2 位小数（Decimal 规避 0.1+0.2 之类浮点漂移） */
export const round2 = (n: number | Decimal | undefined | null): number =>
  new Decimal(safeNum(n)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/** 加法后四舍五入到 2 位 */
export const add2 = (a: number | Decimal, b: number | Decimal): number =>
  new Decimal(safeNum(a)).plus(safeNum(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/** 减法后四舍五入到 2 位 */
export const sub2 = (a: number | Decimal, b: number | Decimal): number =>
  new Decimal(safeNum(a)).minus(safeNum(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/** 乘法后四舍五入到 2 位 */
export const mul2 = (a: number | Decimal, b: number | Decimal): number =>
  new Decimal(safeNum(a)).times(safeNum(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/** 除法后四舍五入到 2 位 */
export const div2 = (a: number | Decimal, b: number | Decimal): number => {
  const bn = safeNum(b);
  if (bn === 0) return 0;
  return new Decimal(safeNum(a)).dividedBy(bn).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
};

/** 元 → 分（整数），微信支付等以分为单位的接口 */
export const toCents = (n: number | Decimal): number =>
  new Decimal(n).times(100).round().toNumber();

/** 分 → 元（2 位小数） */
export const fromCents = (n: number): number =>
  new Decimal(n).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/** 格式化为 2 位小数字符串，支付宝等金额参数 */
export const format2 = (n: number | Decimal): string =>
  new Decimal(n).toFixed(2);

/** 金额比较：a < b */
export const lt = (a: number | Decimal, b: number | Decimal): boolean =>
  new Decimal(a).lt(b);

/** 金额比较：a > b */
export const gt = (a: number | Decimal, b: number | Decimal): boolean =>
  new Decimal(a).gt(b);

/** 取最小值（2 位小数） */
export const min2 = (a: number | Decimal, b: number | Decimal): number =>
  Decimal.min(new Decimal(a), new Decimal(b))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();

/** 取最大值（2 位小数） */
export const max2 = (a: number | Decimal, b: number | Decimal): number =>
  Decimal.max(new Decimal(a), new Decimal(b))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();

/** 限制在 [0, 1] 区间（比例值） */
export const clamp01d = (n: number | Decimal): number =>
  Decimal.min(1, Decimal.max(0, new Decimal(n))).toNumber();

export { Decimal };
