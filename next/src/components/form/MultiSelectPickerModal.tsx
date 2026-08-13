'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RegionCascader } from './RegionCascader';
import { CategoryCascader } from './CategoryCascader';
import { getCategoryTree, type ServiceCategoryNode } from '@/lib/admin-api';
import { Modal } from '../Modal';
import type { RegionValue } from '@/data/region';

// ───────────────────────── 地区多选弹窗 ─────────────────────────

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

/**
 * 通知范围 / 接单范围 的弹窗化选择器。
 * 父级用一个按钮触发，弹窗内级联选择 → + 添加 → 确认提交；
 * 草稿在弹窗关闭前必定并入（点「确认」即把未添加草稿一起提交），不再需要提交前拦截。
 */
export function RegionPickerModal({
  open,
  onClose,
  title = '选择范围',
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  value: RegionValue[];
  onChange: (v: RegionValue[]) => void;
}) {
  const [draft, setDraft] = useState<RegionValue>(EMPTY);
  const [local, setLocal] = useState<RegionValue[]>(value);

  // 弹窗打开时以外部 value 为初始值；关闭后复位，避免下次打开残留。
  useEffect(() => {
    if (open) {
      setLocal(value.map((v) => ({ ...v })));
      setDraft(EMPTY);
    }
    // 仅在 open 切换时重置，不随外部 value 变化而重置（避免录入中丢失）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const add = () => {
    if (!draft.provinceCode) return;
    const key = scopeKey(draft);
    if (!local.some((v) => scopeKey(v) === key)) {
      setLocal([...local, { ...draft }]);
    }
    setDraft(EMPTY);
  };

  const remove = (key: string) =>
    setLocal(local.filter((v) => scopeKey(v) !== key));

  const confirm = () => {
    onChange(local);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="md"
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            取消
          </button>
          <button type="button" className="btn-primary" onClick={confirm}>
            确认
          </button>
        </>
      }
    >
      <p className="field-hint" style={{ marginTop: -4, marginBottom: 12 }}>
        选择省 / 市 / 区后点「+ 添加」，可添加多条；留空 = 全部可见。
      </p>
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
      {local.length === 0 ? (
        <p className="field-hint" style={{ marginTop: 10 }}>
          尚未添加范围
        </p>
      ) : (
        <div className="region-chips" style={{ marginTop: 10 }}>
          {local.map((v) => (
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
    </Modal>
  );
}

// ───────────────────────── 类目多选弹窗 ─────────────────────────

interface FlatNode {
  id: string;
  name: string;
  parentId: string | null;
}
function flatten(nodes: ServiceCategoryNode[], acc: FlatNode[] = []): FlatNode[] {
  nodes.forEach((n) => {
    acc.push({ id: n.id, name: n.name, parentId: n.parentId ?? null });
    if (n.children?.length) flatten(n.children, acc);
  });
  return acc;
}

/**
 * 师傅「擅长技能」弹窗化选择器：数据来源服务类目树，选中类目节点 id 集合。
 * 形态与 RegionPickerModal 一致（按钮触发 → 级联选择 → + 添加 → 确认）。
 */
export function CategoryPickerModal({
  open,
  onClose,
  title = '选择擅长技能',
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { data: tree = [] } = useQuery({
    queryKey: ['categoryTree'],
    queryFn: getCategoryTree,
  });

  const nameMap = useMemo(() => {
    const flat = flatten(tree);
    const m = new Map<string, string>();
    flat.forEach((n) => m.set(n.id, n.name));
    return m;
  }, [tree]);

  const [draft, setDraft] = useState('');
  const [local, setLocal] = useState<string[]>(value);

  useEffect(() => {
    if (open) {
      setLocal([...value]);
      setDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const add = () => {
    if (!draft) return;
    if (!local.includes(draft)) setLocal([...local, draft]);
    setDraft('');
  };

  const remove = (id: string) => setLocal(local.filter((v) => v !== id));

  const confirm = () => {
    onChange(local);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="md"
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            取消
          </button>
          <button type="button" className="btn-primary" onClick={confirm}>
            确认
          </button>
        </>
      }
    >
      <p className="field-hint" style={{ marginTop: -4, marginBottom: 12 }}>
        从服务类目树选择你擅长的类目节点（可多选；选到业务域即覆盖其下所有服务）。
      </p>
      <div className="region-multi-picker">
        <CategoryCascader value={draft} onChange={setDraft} />
        <button
          type="button"
          className="region-add-btn"
          onClick={add}
          disabled={!draft}
        >
          + 添加
        </button>
      </div>
      {local.length === 0 ? (
        <p className="field-hint" style={{ marginTop: 10 }}>
          尚未添加技能
        </p>
      ) : (
        <div className="region-chips" style={{ marginTop: 10 }}>
          {local.map((id) => (
            <span key={id} className="region-chip">
              {nameMap.get(id) ?? '未知类目'}
              <button
                type="button"
                className="region-chip-remove"
                aria-label="移除"
                onClick={() => remove(id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </Modal>
  );
}
