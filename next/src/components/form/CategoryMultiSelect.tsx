'use client';

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CategoryCascader } from './CategoryCascader';
import { getCategoryTree, type ServiceCategoryNode } from '@/lib/admin-api';

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

// 对外暴露的命令式接口：用于父表单提交前拦截「已选未添加」
export interface CategoryMultiSelectHandle {
  hasPending: () => boolean;
  pendingText: () => string;
}

// 师傅「擅长技能」多选：数据来源于服务类目树（业务域/子类目/具体服务节点），
// 选中的是类目节点 id 集合，派单时由服务叶子向上找祖先命中即精准匹配。
// 视觉与 RegionMultiSelect 一致（复用其 .region-* 样式类），同样带「已选未添加」拦截。
export const CategoryMultiSelect = forwardRef<
  CategoryMultiSelectHandle,
  { value: string[]; onChange: (v: string[]) => void }
>(function CategoryMultiSelect({ value, onChange }, ref) {
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

  // 父表单提交前可调用：判断是否存在「已选但未点添加」的待提交选择
  useImperativeHandle(
    ref,
    () => ({
      hasPending: () => !!draft,
      pendingText: () => (draft ? nameMap.get(draft) ?? '' : ''),
    }),
    [draft, nameMap],
  );

  const add = () => {
    if (!draft) return;
    if (!value.includes(draft)) onChange([...value, draft]);
    setDraft('');
  };

  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  const pendingText = draft ? nameMap.get(draft) ?? '' : '';

  return (
    <div className="region-multi">
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

      {pendingText && (
        <p className="region-pending" style={{ marginTop: 6 }}>
          已选择「{pendingText}」尚未添加，请先点「+ 添加」加入擅长技能
        </p>
      )}

      {value.length === 0 ? (
        <p className="field-hint" style={{ marginTop: 6 }}>
          未设置（空 = 暂未标注擅长类目）
        </p>
      ) : (
        <div className="region-chips" style={{ marginTop: 8 }}>
          {value.map((id) => (
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
    </div>
  );
});
