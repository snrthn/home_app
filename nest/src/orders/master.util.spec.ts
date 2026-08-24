import { masterCoversOrder, slotsOverlap } from './master.util';

describe('masterCoversOrder - 师傅地域覆盖判定', () => {
  describe('空数据 → false', () => {
    it('master null + addr 有值 → false', () => {
      expect(masterCoversOrder(null, { provinceCode: '11' })).toBe(false);
    });
    it('master 空对象 + addr 有值 → false', () => {
      expect(masterCoversOrder({}, { provinceCode: '11' })).toBe(false);
    });
    it('master 有值 + addr null → false（规则集空后 regionMatches 空→true，但 rules 非空）', () => {
      // master has home province, rules non-empty → regionMatches([], null addr) 
      // addr null → addr.provinceCode undefined, rules=[{provinceCode:'11'}]
      // matchLevel('11', undefined) → false
      expect(masterCoversOrder({ provinceCode: '11' }, null)).toBe(false);
    });
    it('master 空对象 + addr null → false', () => {
      expect(masterCoversOrder({}, null)).toBe(false);
    });
    it('master null + addr null → false', () => {
      expect(masterCoversOrder(null, null)).toBe(false);
    });
  });

  describe('所在地匹配', () => {
    it('所在地省级匹配 → true', () => {
      expect(masterCoversOrder(
        { provinceCode: '11', cityCode: null, districtCode: null },
        { provinceCode: '11', cityCode: '1101', districtCode: '110101' },
      )).toBe(true);
    });
    it('所在地市级精确 → true', () => {
      expect(masterCoversOrder(
        { provinceCode: '11', cityCode: '1101', districtCode: null },
        { provinceCode: '11', cityCode: '1101', districtCode: '110101' },
      )).toBe(true);
    });
    it('所在地市级不匹配 → false', () => {
      expect(masterCoversOrder(
        { provinceCode: '11', cityCode: '1101', districtCode: null },
        { provinceCode: '11', cityCode: '1102', districtCode: '110201' },
      )).toBe(false);
    });
    it('所在地省级不匹配 → false', () => {
      expect(masterCoversOrder(
        { provinceCode: '12', cityCode: null, districtCode: null },
        { provinceCode: '11', cityCode: '1101', districtCode: '110101' },
      )).toBe(false);
    });
  });

  describe('接单范围匹配', () => {
    it('serviceAreas 命中 → true', () => {
      expect(masterCoversOrder(
        {
          provinceCode: null,
          serviceAreas: [{ provinceCode: '11', cityCode: '1101' }],
        },
        { provinceCode: '11', cityCode: '1101', districtCode: '110101' },
      )).toBe(true);
    });
    it('serviceAreas 不命中 → false', () => {
      expect(masterCoversOrder(
        {
          provinceCode: null,
          serviceAreas: [{ provinceCode: '12', cityCode: '1201' }],
        },
        { provinceCode: '11', cityCode: '1101', districtCode: '110101' },
      )).toBe(false);
    });
    it('多 serviceAreas 任一命中 → true', () => {
      expect(masterCoversOrder(
        {
          provinceCode: null,
          serviceAreas: [
            { provinceCode: '12', cityCode: '1201' },
            { provinceCode: '11', cityCode: '1101' },
          ],
        },
        { provinceCode: '11', cityCode: '1101', districtCode: '110101' },
      )).toBe(true);
    });
  });

  describe('并集语义（所在地 ∪ 接单范围）', () => {
    it('所在地不匹配但 serviceAreas 匹配 → true', () => {
      expect(masterCoversOrder(
        {
          provinceCode: '12',
          cityCode: null,
          districtCode: null,
          serviceAreas: [{ provinceCode: '11', cityCode: '1101' }],
        },
        { provinceCode: '11', cityCode: '1101', districtCode: '110101' },
      )).toBe(true);
    });
    it('所在地匹配但 serviceAreas 不匹配 → true', () => {
      expect(masterCoversOrder(
        {
          provinceCode: '11',
          cityCode: null,
          districtCode: null,
          serviceAreas: [{ provinceCode: '12', cityCode: '1201' }],
        },
        { provinceCode: '11', cityCode: '1101', districtCode: '110101' },
      )).toBe(true);
    });
    it('两者皆不匹配 → false', () => {
      expect(masterCoversOrder(
        {
          provinceCode: '12',
          cityCode: null,
          districtCode: null,
          serviceAreas: [{ provinceCode: '13', cityCode: '1301' }],
        },
        { provinceCode: '11', cityCode: '1101', districtCode: '110101' },
      )).toBe(false);
    });
  });
});

describe('slotsOverlap - 预约时段重叠', () => {
  describe('HH:mm-HH:mm 区间格式', () => {
    it('部分重叠 → true', () => {
      expect(slotsOverlap('09:00-11:00', '10:00-12:00')).toBe(true);
    });
    it('完全包含 → true', () => {
      expect(slotsOverlap('09:00-12:00', '10:00-11:00')).toBe(true);
    });
    it('完全相同 → true', () => {
      expect(slotsOverlap('09:00-11:00', '09:00-11:00')).toBe(true);
    });
    it('不重叠（前后分离）→ false', () => {
      expect(slotsOverlap('09:00-10:00', '10:00-11:00')).toBe(false);
    });
    it('不重叠（远距）→ false', () => {
      expect(slotsOverlap('08:00-09:00', '14:00-15:00')).toBe(false);
    });
    it('边界相接（a 止=b 起）→ false（半开区间）', () => {
      expect(slotsOverlap('09:00-10:00', '10:00-11:00')).toBe(false);
    });
  });

  describe('空值 / null', () => {
    it('一方为空 → false', () => {
      expect(slotsOverlap(null, '10:00-11:00')).toBe(false);
      expect(slotsOverlap('10:00-11:00', null)).toBe(false);
    });
    it('双方为空 → false', () => {
      expect(slotsOverlap(null, null)).toBe(false);
    });
    it('空字符串 → false', () => {
      expect(slotsOverlap('', '10:00-11:00')).toBe(false);
    });
  });

  describe('自由文本 / 枚举', () => {
    it('相同文本 → true（冲突）', () => {
      expect(slotsOverlap('上午', '上午')).toBe(true);
    });
    it('不同文本 → false', () => {
      expect(slotsOverlap('上午', '下午')).toBe(false);
    });
    it('带空格的相同文本 → true（去空白后相等）', () => {
      expect(slotsOverlap(' 上 午 ', '上午')).toBe(true);
    });
  });

  describe('混合格式（一区间一文本）', () => {
    it('区间 vs 文本 → false（格式不同，字符串不等）', () => {
      expect(slotsOverlap('09:00-11:00', '上午')).toBe(false);
    });
  });

  describe('单边时间格式（非区间）', () => {
    it('两个非区间但非空 → 字符串比较', () => {
      expect(slotsOverlap('14:30', '14:30')).toBe(true);
      expect(slotsOverlap('14:30', '15:00')).toBe(false);
    });
  });
});
