import { regionMatches } from '../common/region-match';

interface MasterRegion {
  serviceAreas?: any;
  provinceCode?: string | null;
  cityCode?: string | null;
  districtCode?: string | null;
}

interface AddrRegion {
  provinceCode?: string | null;
  cityCode?: string | null;
  districtCode?: string | null;
}

/** 师傅「所在地 ∪ 接单范围」是否覆盖订单地址（接单池过滤/抢单校验 共用）。
 *  严格模式：两者皆空 → 不覆盖。
 *  code-only 匹配（撤掉名称兜底，避免「市辖区」跨城市误命中）。 */
export function masterCoversOrder(
  master: MasterRegion | null,
  addr: AddrRegion | null | undefined,
): boolean {
  const areas = (master?.serviceAreas as any[]) ?? [];
  const home = master?.provinceCode
    ? [
        {
          provinceCode: master.provinceCode,
          cityCode: master.cityCode,
          districtCode: master.districtCode,
        },
      ]
    : [];
  const rules = [...areas, ...home];
  if (rules.length === 0) return false;
  return regionMatches(rules, {
    provinceCode: addr?.provinceCode,
    cityCode: addr?.cityCode,
    districtCode: addr?.districtCode,
  });
}

/** 预约时段重叠判定：双方均为 "HH:mm-HH:mm" 区间格式 → 区间相交；
 *  否则（枚举/自由文本如「上午」）去空白后字符串相等即冲突。 */
export function slotsOverlap(a?: string | null, b?: string | null): boolean {
  const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, '');
  const pa = norm(a);
  const pb = norm(b);
  if (!pa || !pb) return false;
  const toMin = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const ra = pa.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  const rb = pb.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (ra && rb) {
    const a1 = toMin(ra[1]);
    const a2 = toMin(ra[2]);
    const b1 = toMin(rb[1]);
    const b2 = toMin(rb[2]);
    if (a1 === null || a2 === null || b1 === null || b2 === null) return false;
    return a1 < b2 && b1 < a2;
  }
  return pa === pb;
}
