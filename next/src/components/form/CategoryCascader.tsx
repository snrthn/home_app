'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCategoryTree, type ServiceCategoryNode } from '@/lib/admin-api';
import { SelectInput } from './SelectInput';

interface FlatNode {
  id: string;
  parentId: string | null;
  name: string;
}

function flatten(nodes: ServiceCategoryNode[], acc: FlatNode[] = []): FlatNode[] {
  nodes.forEach((n) => {
    acc.push({ id: n.id, parentId: n.parentId ?? null, name: n.name });
    if (n.children?.length) flatten(n.children, acc);
  });
  return acc;
}

// 类目三级联动：业务域 → 子类目 → 具体服务（最多三级），输出选中的类目节点 id。
// 类目树由后端 getCategoryTree 提供，纯树结构、无第二维度，运营只需一次定位。
export function CategoryCascader({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: tree = [] } = useQuery({
    queryKey: ['categoryTree'],
    queryFn: getCategoryTree,
  });

  const { flat, childMap, parentMap } = useMemo(() => {
    const f = flatten(tree);
    const cm = new Map<string, FlatNode[]>();
    const pm = new Map<string, string | null>();
    f.forEach((n) => {
      pm.set(n.id, n.parentId);
      if (n.parentId) {
        if (!cm.has(n.parentId)) cm.set(n.parentId, []);
        cm.get(n.parentId)!.push(n);
      }
    });
    return { flat: f, childMap: cm, parentMap: pm };
  }, [tree]);

  const resolvePath = (id: string): string[] => {
    const path: string[] = [];
    let cur: string | null | undefined = id;
    while (cur) {
      path.unshift(cur);
      cur = parentMap.get(cur) ?? null;
    }
    return path; // [一级, 二级, 三级]
  };

  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');
  const [l3, setL3] = useState('');

  useEffect(() => {
    const p = value ? resolvePath(value) : [];
    setL1(p[0] ?? '');
    setL2(p[1] ?? '');
    setL3(p[2] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, tree]);

  const roots = flat.filter((n) => !n.parentId);
  const l2opts = l1 ? childMap.get(l1) ?? [] : [];
  const l3opts = l2 ? childMap.get(l2) ?? [] : [];

  const emit = (id: string) => {
    if (id) onChange(id);
  };

  return (
    <div className="region-row">
      <SelectInput
        value={l1}
        onChange={(e) => {
          const id = e.target.value;
          setL1(id);
          setL2('');
          setL3('');
          emit(id);
        }}
      >
        <option value="">一级类目</option>
        {roots.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </SelectInput>
      <SelectInput
        value={l2}
        disabled={!l2opts.length}
        onChange={(e) => {
          const id = e.target.value;
          setL2(id);
          setL3('');
          emit(id);
        }}
      >
        <option value="">二级类目</option>
        {l2opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </SelectInput>
      <SelectInput
        value={l3}
        disabled={!l3opts.length}
        onChange={(e) => {
          const id = e.target.value;
          setL3(id);
          emit(id);
        }}
      >
        <option value="">三级类目</option>
        {l3opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}
