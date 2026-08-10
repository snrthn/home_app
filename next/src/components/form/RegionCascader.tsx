'use client';

import { useEffect, useState } from 'react';
import {
  provinceOptions,
  getCities,
  getAreas,
  isMunicipality,
  getMunicipalityCity,
  type RegionOption,
} from '@/data/region';
import { SelectInput } from './SelectInput';

export interface RegionValue {
  province?: string | null;
  provinceCode?: string | null;
  city?: string | null;
  cityCode?: string | null;
  district?: string | null;
  districtCode?: string | null;
}

// 省/市/区三级联动，产出「省code/市code/区code」+ 名称，符合后端字段要求
// 直辖市（无地级市层级）自动带出「市辖区」，保证后面两级可正常展开。
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
          // 直辖市：自动带出「市辖区」，使区级可展开
          if (code && isMunicipality(code)) {
            const mc = getMunicipalityCity(code);
            base.city = mc.name;
            base.cityCode = mc.code;
          }
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
        value={
          isMun
            ? value.cityCode ?? syntheticCity?.code ?? ''
            : value.cityCode ?? ''
        }
        disabled={isMun || !cities.length}
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
