'use client';

import { forwardRef, useImperativeHandle, useState } from 'react';
import { RegionCascader } from './RegionCascader';
import type { RegionValue } from '@/data/region';

const EMPTY: RegionValue = {
  province: null,
  provinceCode: null,
  city: null,
  cityCode: null,
  district: null,
  districtCode: null,
};

// 将一条范围格式化为可读文本：只拼非空的「省 / 市 / 区」层级
export function formatRegionScope(v: RegionValue): string {
  return [v.province, v.city, v.district].filter(Boolean).join(' / ');
}

// 去重 key：按省/市/区 code 拼装，缺级即代表该级通配
function scopeKey(v: RegionValue): string {
  return [v.provinceCode, v.cityCode, v.districtCode].filter(Boolean).join('/');
}

// 对外暴露的命令式接口：用于父表单提交前拦截「已选未添加」
export interface RegionMultiSelectHandle {
  /** 是否已选择地区、但尚未点击「添加」进入表单范围列表 */
  hasPending: () => boolean;
  /** 返回已选但未添加的地区可读文本（空串表示无待添加项），用于拦截提示 */
  pendingText: () => string;
}

// 多选区域范围：基于 RegionCascader 单值选择器累积多条，支持省/市/区部分粒度
// 用于「师傅接单范围」「公告通知范围」等同构场景。候选项为完整行政区字典。
export const RegionMultiSelect = forwardRef<
  RegionMultiSelectHandle,
  { value: RegionValue[]; onChange: (v: RegionValue[]) => void }
>(function RegionMultiSelect({ value, onChange }, ref) {
  const [draft, setDraft] = useState<RegionValue>(EMPTY);

  // 父表单提交前可调用：判断是否存在「已选但未点添加」的待提交选择
  useImperativeHandle(
    ref,
    () => ({
      hasPending: () => !!draft.provinceCode,
      pendingText: () => (draft.provinceCode ? formatRegionScope(draft) : ''),
    }),
    [draft],
  );

  const add = () => {
    if (!draft.provinceCode) return;
    const key = scopeKey(draft);
    // 已存在同一条则忽略（保留首次粒度）
    if (!value.some((v) => scopeKey(v) === key)) {
      onChange([...value, { ...draft }]);
    }
    setDraft(EMPTY);
  };

  const remove = (key: string) =>
    onChange(value.filter((v) => scopeKey(v) !== key));

  const pendingText = draft.provinceCode ? formatRegionScope(draft) : '';

  return (
    <div className="region-multi">
      <div className="region-multi-picker">
        <RegionCascader value={draft} onChange={setDraft} />
        <button
          type="button"
          className="region-add-btn"
          onClick={add}
          disabled={!draft.provinceCode}
        >
          + 添加
        </button>
      </div>

      {pendingText && (
        <p className="region-pending" style={{ marginTop: 6 }}>
          已选择「{pendingText}」尚未添加，请先点「+ 添加」加入范围
        </p>
      )}

      {value.length === 0 ? (
        <p className="field-hint" style={{ marginTop: 6 }}>
          未设置（空 = 全平台可接单）
        </p>
      ) : (
        <div className="region-chips" style={{ marginTop: 8 }}>
          {value.map((v) => (
            <span key={scopeKey(v)} className="region-chip">
              {formatRegionScope(v)}
              <button
                type="button"
                className="region-chip-remove"
                aria-label="移除"
                onClick={() => remove(scopeKey(v))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
