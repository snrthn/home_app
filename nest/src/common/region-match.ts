// 地域命中匹配：公告通知范围(targetRegions) 与 接单池(serviceAreas) 共用同一套规则。
//
// 规则（与 notices.service 原 matchRegion 等价，并扩展支持「名称」匹配，因为订单/地址侧
// 目前只存了省/市/区【名称】，没有行政 code；而公告/通知侧用的是 code）：
//   - targetRegions 为空/null → 返回 true（调用方需自行处理「严格不可见」语义）
//   - 否则逐条规则匹配：province 必需命中（code 优先，缺 code 用名称）；
//     city / district 缺级通配；任一规则全级命中即视为可见。
//   - 某一级「规则限定了、但被匹配方缺该级值」→ 不命中（严格）。

export interface RegionLike {
  province?: string | null;
  provinceCode?: string | null;
  city?: string | null;
  cityCode?: string | null;
  district?: string | null;
  districtCode?: string | null;
}

function matchLevel(
  ruleCode: string | null | undefined,
  ruleName: string | null | undefined,
  regionCode: string | null | undefined,
  regionName: string | null | undefined,
): boolean {
  // 优先用双方都有的维度比对：都有 code 走 code，都有名称走名称
  if (regionCode != null && ruleCode != null) return ruleCode === regionCode;
  if (regionName != null && ruleName != null) return ruleName === regionName;
  // 一方限定了该级、另一方缺值 → 无法匹配
  if (ruleCode != null || ruleName != null) return false;
  // 规则未限定该级 → 通配
  return true;
}

export function regionMatches(
  targetRegions: RegionLike[] | null | undefined,
  region: RegionLike,
): boolean {
  if (!targetRegions || targetRegions.length === 0) return true;
  return targetRegions.some((r) => {
    if (!matchLevel(r.provinceCode, r.province, region.provinceCode, region.province)) return false;
    if (!matchLevel(r.cityCode, r.city, region.cityCode, region.city)) return false;
    if (!matchLevel(r.districtCode, r.district, region.districtCode, region.district)) return false;
    return true;
  });
}
