// 中国行政区数据（省/市/区三级），来自 province-city-china，已 vendor 到 ./region/*.json
// 注意：保存时使用 6 位行政编码（provinceCode/cityCode/districtCode），
// 与用户要求的「省code/市code/区code」一致。
import provinces from './region/province.json';
import cities from './region/city.json';
import areas from './region/area.json';

interface Prov {
  code: string;
  name: string;
  province: string;
}
interface City {
  code: string;
  name: string;
  province: string;
  city: string;
}
interface Area {
  code: string;
  name: string;
  province: string;
  city: string;
  area: string;
}

export interface RegionOption {
  code: string;
  name: string;
}

// 省份列表
export const provinceOptions: RegionOption[] = (provinces as Prov[]).map((p) => ({
  code: p.code,
  name: p.name,
}));

const provinceField = (provinceCode: string): string => provinceCode.slice(0, 2);
const cityField = (cityCode: string): string => cityCode.slice(2, 4);

// 由省份 6 位编码取下属城市
export function getCities(provinceCode: string): RegionOption[] {
  if (!provinceCode) return [];
  const pf = provinceField(provinceCode);
  return (cities as City[])
    .filter((c) => c.province === pf)
    .map((c) => ({ code: c.code, name: c.name }));
}

// 由省份+城市 6 位编码取下属区/县
export function getAreas(provinceCode: string, cityCode: string): RegionOption[] {
  if (!provinceCode || !cityCode) return [];
  const pf = provinceField(provinceCode);
  const cf = cityField(cityCode);
  return (areas as Area[])
    .filter((a) => a.province === pf && a.city === cf)
    .map((a) => ({ code: a.code, name: a.name }));
}

// 在指定列表中反查编码对应的名称（用于回填展示）
export function findName(code: string | null | undefined, list: RegionOption[]): string {
  if (!code) return '';
  return list.find((o) => o.code === code)?.name ?? '';
}

// 直辖市（北京/天津/上海/重庆等）无地级市层级：city.json 中该省下属城市数为 0，
// 区/县直接挂在省下（area.city = '01'）。据此判定是否为直辖市。
export function isMunicipality(provinceCode: string): boolean {
  if (!provinceCode) return false;
  return getCities(provinceCode).length === 0;
}

// 直辖市的合成「城市」层级：如 北京 110000 → 市辖区 110100，
// 区/县选择器在 getAreas 时用 city='01' 命中。
export function getMunicipalityCity(provinceCode: string): RegionOption {
  return { code: provinceCode.slice(0, 2) + '0100', name: '市辖区' };
}

// 根据已保存的 6 位编码反查各级名称，组成 {province, city, district} 文本（用于只读展示）
export function regionText(v: {
  provinceCode?: string | null;
  cityCode?: string | null;
  districtCode?: string | null;
}): string {
  if (!v.provinceCode) return '';
  const prov = findName(v.provinceCode, provinceOptions);
  const cityList = getCities(v.provinceCode);
  const city =
    v.cityCode
      ? cityList.length
        ? findName(v.cityCode, cityList)
        : isMunicipality(v.provinceCode)
          ? '市辖区'
          : ''
      : '';
  const areaList = v.cityCode ? getAreas(v.provinceCode, v.cityCode) : [];
  const district = v.districtCode ? findName(v.districtCode, areaList) : '';
  return [prov, city, district].filter(Boolean).join(' / ');
}
