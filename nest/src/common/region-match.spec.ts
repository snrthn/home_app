import { regionMatches, serviceAreasToRules, type RegionLike } from './region-match';

describe('regionMatches - 地域规则命中', () => {
  describe('空规则集 → true', () => {
    it('null → true', () => {
      expect(regionMatches(null, { provinceCode: '11' })).toBe(true);
    });
    it('空数组 → true', () => {
      expect(regionMatches([], { provinceCode: '11' })).toBe(true);
    });
    it('undefined → true', () => {
      expect(regionMatches(undefined, { provinceCode: '11' })).toBe(true);
    });
  });

  describe('省级匹配（通配全省）', () => {
    const rules: RegionLike[] = [{ provinceCode: '11' }];
    it('同省同市同区 → true', () => {
      expect(regionMatches(rules, { provinceCode: '11', cityCode: '1101', districtCode: '110101' })).toBe(true);
    });
    it('同省不同市 → true（省级通配）', () => {
      expect(regionMatches(rules, { provinceCode: '11', cityCode: '1102', districtCode: '110201' })).toBe(true);
    });
    it('同省缺市级 → true（缺级通配）', () => {
      expect(regionMatches(rules, { provinceCode: '11' })).toBe(true);
    });
    it('不同省 → false', () => {
      expect(regionMatches(rules, { provinceCode: '12' })).toBe(false);
    });
  });

  describe('市级匹配（通配全市）', () => {
    const rules: RegionLike[] = [{ provinceCode: '11', cityCode: '1101' }];
    it('同市同区 → true', () => {
      expect(regionMatches(rules, { provinceCode: '11', cityCode: '1101', districtCode: '110101' })).toBe(true);
    });
    it('同市不同区 → true', () => {
      expect(regionMatches(rules, { provinceCode: '11', cityCode: '1101', districtCode: '110102' })).toBe(true);
    });
    it('同省不同市 → false', () => {
      expect(regionMatches(rules, { provinceCode: '11', cityCode: '1102' })).toBe(false);
    });
    it('被匹配方缺市级 code → false（规则限定了市级）', () => {
      expect(regionMatches(rules, { provinceCode: '11' })).toBe(false);
    });
  });

  describe('区级精确匹配', () => {
    const rules: RegionLike[] = [{ provinceCode: '11', cityCode: '1101', districtCode: '110101' }];
    it('精确命中 → true', () => {
      expect(regionMatches(rules, { provinceCode: '11', cityCode: '1101', districtCode: '110101' })).toBe(true);
    });
    it('同市不同区 → false', () => {
      expect(regionMatches(rules, { provinceCode: '11', cityCode: '1101', districtCode: '110102' })).toBe(false);
    });
    it('缺区级 code → false', () => {
      expect(regionMatches(rules, { provinceCode: '11', cityCode: '1101' })).toBe(false);
    });
  });

  describe('多规则任一命中即 true', () => {
    const rules: RegionLike[] = [
      { provinceCode: '11', cityCode: '1101' },
      { provinceCode: '12', cityCode: '1201' },
    ];
    it('命中第一条 → true', () => {
      expect(regionMatches(rules, { provinceCode: '11', cityCode: '1101' })).toBe(true);
    });
    it('命中第二条 → true', () => {
      expect(regionMatches(rules, { provinceCode: '12', cityCode: '1201' })).toBe(true);
    });
    it('都不命中 → false', () => {
      expect(regionMatches(rules, { provinceCode: '13' })).toBe(false);
    });
  });

  describe('名称不参与匹配', () => {
    it('province 名称不同但 code 相同 → true', () => {
      expect(regionMatches(
        [{ provinceCode: '11', province: '北京市' }],
        { provinceCode: '11', province: '不同名称' },
      )).toBe(true);
    });
    it('province 名称相同但 code 不同 → false', () => {
      expect(regionMatches(
        [{ provinceCode: '11', province: '北京市' }],
        { provinceCode: '12', province: '北京市' },
      )).toBe(false);
    });
  });

  describe('null code 透传', () => {
    it('规则 provinceCode 为 null → 该级通配', () => {
      expect(regionMatches(
        [{ provinceCode: null, cityCode: '1101' }],
        { provinceCode: '11', cityCode: '1101' },
      )).toBe(true);
    });
    it('被匹配方 provinceCode 为 null 且规则限定 → false', () => {
      expect(regionMatches(
        [{ provinceCode: '11' }],
        { provinceCode: null },
      )).toBe(false);
    });
  });
});

describe('serviceAreasToRules - ServiceArea 转规则集', () => {
  it('level 1（省）只设 provinceCode', () => {
    const rules = serviceAreasToRules([
      { level: 1, provinceCode: '11', cityCode: '1101', districtCode: '110101' },
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0].provinceCode).toBe('11');
    expect(rules[0].cityCode).toBeNull();
    expect(rules[0].districtCode).toBeNull();
  });

  it('level 2（市）设到 cityCode', () => {
    const rules = serviceAreasToRules([
      { level: 2, provinceCode: '11', cityCode: '1101', districtCode: '110101' },
    ]);
    expect(rules[0].provinceCode).toBe('11');
    expect(rules[0].cityCode).toBe('1101');
    expect(rules[0].districtCode).toBeNull();
  });

  it('level 3（区）精确到 districtCode', () => {
    const rules = serviceAreasToRules([
      { level: 3, provinceCode: '11', cityCode: '1101', districtCode: '110101' },
    ]);
    expect(rules[0].provinceCode).toBe('11');
    expect(rules[0].cityCode).toBe('1101');
    expect(rules[0].districtCode).toBe('110101');
  });

  it('null code 透传为 null', () => {
    const rules = serviceAreasToRules([
      { level: 2, provinceCode: null, cityCode: null, districtCode: null },
    ]);
    expect(rules[0].provinceCode).toBeNull();
    expect(rules[0].cityCode).toBeNull();
  });

  it('空数组 → 空规则集', () => {
    expect(serviceAreasToRules([])).toEqual([]);
  });

  it('多区域混合 level', () => {
    const rules = serviceAreasToRules([
      { level: 1, provinceCode: '11', cityCode: null, districtCode: null },
      { level: 2, provinceCode: '12', cityCode: '1201', districtCode: null },
      { level: 3, provinceCode: '13', cityCode: '1301', districtCode: '130101' },
    ]);
    expect(rules).toHaveLength(3);
    expect(rules[0].cityCode).toBeNull();
    expect(rules[1].cityCode).toBe('1201');
    expect(rules[1].districtCode).toBeNull();
    expect(rules[2].districtCode).toBe('130101');
  });
});
