// 地域命中匹配：公告通知范围(targetRegions) / 接单池(serviceAreas) / 下单校验(ServiceArea 开通字典)
// 三处共用同一套规则。
//
// 规则（code-only，撤掉名称兜底——同名不同域如「市辖区」跨城市误匹配风险大于成本）：
//   - targetRegions 为空/null → 返回 true（调用方自行处理「严格不可见」语义）
//   - 否则逐条规则匹配：province 必需命中（code）；city / district 缺级通配；
//     任一规则全级命中即视为可见。
//   - 规则限定了某级 code、被匹配方缺该级 code → 不命中（严格）。
//   - 名称字段仅用于 UI 展示/日志，不参与匹配决策。

export interface RegionLike {
  province?: string | null;
  provinceCode?: string | null;
  city?: string | null;
  cityCode?: string | null;
  district?: string | null;
  districtCode?: string | null;
}

// 规则在该级限定了 code → 被匹配方必须有同 code 才命中；规则未限定 → 通配。
function matchLevel(
  ruleCode: string | null | undefined,
  regionCode: string | null | undefined,
): boolean {
  if (ruleCode != null) return regionCode != null && ruleCode === regionCode;
  return true;
}

export function regionMatches(
  targetRegions: RegionLike[] | null | undefined,
  region: RegionLike,
): boolean {
  if (!targetRegions || targetRegions.length === 0) return true;
  return targetRegions.some((r) => {
    if (!matchLevel(r.provinceCode, region.provinceCode)) return false;
    if (!matchLevel(r.cityCode, region.cityCode)) return false;
    if (!matchLevel(r.districtCode, region.districtCode)) return false;
    return true;
  });
}

// ServiceArea 表（平台开通字典）转 RegionLike 规则集：
// level=1（省）只设 provinceCode → 通配全省；
// level=2（市）设到 cityCode → 通配全市；
// level=3（区）精确到 districtCode。
// 调用方应先过滤 isActive=true && deletedAt=null。
export function serviceAreasToRules(areas: any[]): RegionLike[] {
  return areas.map((a) => ({
    provinceCode: a.provinceCode ?? null,
    cityCode: a.level >= 2 ? (a.cityCode ?? null) : null,
    districtCode: a.level >= 3 ? (a.districtCode ?? null) : null,
  }));
}
