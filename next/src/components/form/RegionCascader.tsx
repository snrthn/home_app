'use client';

import { useEffect, useState } from 'react';
import {
  provinceOptions,
  getCities,
  getAreas,
  isMunicipality,
  getMunicipalityCity,
  type RegionOption,
  type RegionValue,
} from '@/data/region';
import { SelectInput } from './SelectInput';

// 省/市/区三级联动，产出「省code/市code/区code」+ 名称，符合后端字段要求
// 直辖市（无地级市层级）下 city 级放合成「市辖区」选项，但默认不自动选中，
// 由用户手动勾选，保证省市区三级均可自由配置（不冻结、不跳过选区）。
export function RegionCascader({
  value,
  onChange,
}: {
  value: RegionValue;
  onChange: (v: RegionValue) => void;
}) {
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [areas, setAreas] = useState<RegionOption[]>([]);

  const isMun =
    value.provinceCode && isMunicipality(value.provinceCode)
      ? true
      : false;
  const syntheticCity =
    isMun && value.provinceCode
      ? getMunicipalityCity(value.provinceCode)
      : null;

  useEffect(() => {
    if (isMun && syntheticCity) {
      setCities([syntheticCity]);
    } else {
      setCities(value.provinceCode ? getCities(value.provinceCode) : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.provinceCode]);

  useEffect(() => {
    setAreas(
      value.provinceCode && value.cityCode
        ? getAreas(value.provinceCode, value.cityCode)
        : [],
    );
  }, [value.provinceCode, value.cityCode]);

  return (
    <div className="region-row">
      <SelectInput
        value={value.provinceCode ?? ''}
        onChange={(e) => {
          const code = e.target.value;
          const opt = provinceOptions.find((o) => o.code === code);
          const base: RegionValue = {
            province: opt?.name ?? null,
            provinceCode: code || null,
            city: null,
            cityCode: null,
            district: null,
            districtCode: null,
          };
          onChange(base);
        }}
      >
        <option value="">省份</option>
        {provinceOptions.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </SelectInput>

      <SelectInput
        value={value.cityCode ?? ''}
        disabled={!cities.length}
        onChange={(e) => {
          const code = e.target.value;
          const opt = cities.find((o) => o.code === code);
          onChange({
            ...value,
            city: opt?.name ?? null,
            cityCode: code || null,
            district: null,
            districtCode: null,
          });
        }}
      >
        <option value="">城市</option>
        {cities.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </SelectInput>

      <SelectInput
        value={value.districtCode ?? ''}
        disabled={!areas.length}
        onChange={(e) => {
          const code = e.target.value;
          const opt = areas.find((o) => o.code === code);
          onChange({
            ...value,
            district: opt?.name ?? null,
            districtCode: code || null,
          });
        }}
      >
        <option value="">区/县</option>
        {areas.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}
