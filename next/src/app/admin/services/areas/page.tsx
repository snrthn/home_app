'use client';

import { useState, useRef, useEffect, useMemo, type CSSProperties } from 'react';
import { useEscClose } from '@/lib/useEscClose';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getServiceAreas,
  createServiceArea,
  deleteServiceArea,
  setAreaActive,
  type ServiceArea,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { RegionCascader } from '@/components/form/RegionCascader';
import {
  provinceOptions,
  getCities,
  getAreas,
  getMunicipalityCity,
  type RegionValue,
} from '@/data/region';

type Tri = 'checked' | 'unchecked' | 'indeterminate';
type Effective = 'active' | 'self-off' | 'parent-off';

// ---------------- 静态行政区树（一次构建，供树渲染 + 6 段式取数） ----------------
interface RegionNode {
  code: string;
  name: string;
  level: 1 | 2 | 3;
  province: string;
  provinceCode: string;
  parentCode?: string;
  city?: string;
  cityCode?: string;
  district?: string;
  districtCode?: string;
  children?: RegionNode[];
  descendantCodes: string[];
}

function TriCheckbox({
  state,
  onChange,
}: {
  state: Tri;
  onChange: (val: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'indeterminate';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === 'checked'}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

// ---------------- 由 6 段式推导唯一编码（与后端 createArea 的 derive 保持一致） ----------------
function regionCode(v: RegionValue): string {
  return (v.districtCode || v.cityCode || v.provinceCode) ?? '';
}

// ---------------- 状态徽标（派生有效状态） ----------------
function EffectiveBadge({ kind }: { kind: Effective }) {
  const map: Record<Effective, CSSProperties> = {
    active: { background: '#e7f7ee', color: '#1a7f4b', borderRadius: 4, padding: '1px 8px', fontSize: 12 },
    'self-off': { background: '#f1f3f5', color: '#8a94a6', borderRadius: 4, padding: '1px 8px', fontSize: 12 },
    'parent-off': { background: '#fff4e0', color: '#b45309', borderRadius: 4, padding: '1px 8px', fontSize: 12 },
  };
  const text = kind === 'active' ? '生效中' : kind === 'self-off' ? '已停用' : '因父级停用';
  return <span style={map[kind]}>{text}</span>;
}

// ---------------- 开通单个区域（仅选区域，排序/启停走树内联） ----------------
function OpenAreaModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (region: RegionValue) => Promise<void>;
  submitting: boolean;
}) {
  const [region, setRegion] = useState<RegionValue>({});
  const toast = useToast();
  const submit = async () => {
    if (!region.provinceCode) {
      toast.warning('请至少选择省份');
      return;
    }
    await onSubmit(region);
  };
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header">
          <span>开通单个区域</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">区域（省 / 市 / 区）</label>
            <RegionCascader value={region} onChange={setRegion} />
          </div>
          <p className="field-hint" style={{ marginTop: 6 }}>
            开通后默认启用，可在树中调整排序与启停。
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? '开通中…' : '开通'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- 启用/停用 确认弹窗（任何情况都弹；提示内容按有无下级区分） ----------------
function ActiveDialog({
  mode,
  name,
  descendantCount,
  cascade,
  onCascadeChange,
  loading,
  onCancel,
  onConfirm,
}: {
  mode: 'enable' | 'disable';
  name: string;
  descendantCount: number;
  cascade: boolean;
  onCascadeChange: (v: boolean) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isEnable = mode === 'enable';
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-md">
        <div className="modal-header">
          <span>{isEnable ? '启用区域' : '停用区域'}</span>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginTop: 0 }}>确定{isEnable ? '启用' : '停用'}「{name}」？</p>
          {!isEnable && descendantCount > 0 && (
            <p className="field-hint">
              将同时停用其下全部 {descendantCount} 个区域（共 {descendantCount + 1} 个）。停用后该区域及下级暂不对外服务，可随时重新启用。
            </p>
          )}
          {isEnable && descendantCount > 0 && (
            <label
              className="checkbox-label"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontWeight: 600, color: '#b45309' }}
            >
              <input type="checkbox" checked={cascade} onChange={(e) => onCascadeChange(e.target.checked)} />
              同时启用其下 {descendantCount} 个区域（默认只启用当前节点）
            </label>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? (isEnable ? '启用中…' : '停用中…') : isEnable ? '确认启用' : '确认停用'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServiceAreasPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data = [], isLoading: loading } = useQuery<ServiceArea[]>({
    queryKey: QK.adminServiceAreas,
    queryFn: () => getServiceAreas(),
  });

  // 已开通节点按 code 索引
  const openedByCode = useMemo(() => {
    const m = new Map<string, ServiceArea>();
    data.forEach((a) => m.set(a.code, a));
    return m;
  }, [data]);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const inited = useRef(false);
  useEffect(() => {
    // 仅在「首次数据真正加载完成」后同步一次，避免覆盖用户未保存的勾选。
    // 注意：data 默认为 []（truthy），刷新时 loading 阶段的 data=[] 也会触发 effect，
    // 若只用 `data` 判据会让 inited 提前置位，导致真实数据到达后不再同步（刷新后勾选丢失）。
    if (!inited.current && !loading && data) {
      setChecked(new Set(data.map((a) => a.code)));
      inited.current = true;
    }
  }, [data, loading]);

  const [expandedP, setExpandedP] = useState<Set<string>>(new Set());
  const [expandedC, setExpandedC] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // 开通单个区域弹窗
  const [createOpen, setCreateOpen] = useState(false);
  // Esc 关闭所有弹窗
  useEscClose(() => {
    setCreateOpen(false);
    setActiveDialog(null);
  });
  // 启用/停用确认弹窗
  const [activeDialog, setActiveDialog] = useState<{
    mode: 'enable' | 'disable';
    area: ServiceArea;
    node: RegionNode;
    cascade: boolean;
    loading: boolean;
  } | null>(null);

  // ---------------- 静态行政区树（直辖市挂合成「市辖区」节点） ----------------
  const tree = useMemo<RegionNode[]>(() => {
    return provinceOptions.map((p) => {
      const citiesRaw = getCities(p.code);
      let cityNodes: RegionNode[];
      if (citiesRaw.length === 0) {
        const mc = getMunicipalityCity(p.code);
        const areas = getAreas(p.code, mc.code);
        const districtNodes: RegionNode[] = areas.map((a) => ({
          code: a.code,
          name: a.name,
          level: 3,
          province: p.name,
          provinceCode: p.code,
          parentCode: mc.code,
          city: mc.name,
          cityCode: mc.code,
          district: a.name,
          districtCode: a.code,
          descendantCodes: [a.code],
        }));
        cityNodes = [
          {
            code: mc.code,
            name: mc.name,
            level: 2,
            province: p.name,
            provinceCode: p.code,
            parentCode: p.code,
            city: mc.name,
            cityCode: mc.code,
            children: districtNodes,
            descendantCodes: [mc.code, ...districtNodes.map((d) => d.code)],
          },
        ];
      } else {
        cityNodes = citiesRaw.map((c) => {
          const areas = getAreas(p.code, c.code);
          const districtNodes: RegionNode[] = areas.map((a) => ({
            code: a.code,
            name: a.name,
            level: 3,
            province: p.name,
            provinceCode: p.code,
            parentCode: c.code,
            city: c.name,
            cityCode: c.code,
            district: a.name,
            districtCode: a.code,
            descendantCodes: [a.code],
          }));
          return {
            code: c.code,
            name: c.name,
            level: 2,
            province: p.name,
            provinceCode: p.code,
            parentCode: p.code,
            city: c.name,
            cityCode: c.code,
            children: districtNodes,
            descendantCodes: [c.code, ...districtNodes.map((d) => d.code)],
          };
        });
      }
      return {
        code: p.code,
        name: p.name,
        level: 1,
        province: p.name,
        provinceCode: p.code,
        children: cityNodes,
        descendantCodes: [p.code, ...cityNodes.flatMap((c) => c.descendantCodes)],
      };
    });
  }, []);

  const nodeMap = useMemo(() => {
    const m = new Map<string, RegionNode>();
    const walk = (nodes: RegionNode[]) =>
      nodes.forEach((n) => {
        m.set(n.code, n);
        if (n.children) walk(n.children);
      });
    walk(tree);
    return m;
  }, [tree]);

  // 搜索：命中节点 + 其祖先一并展示，并强制展开
  const matchedCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    const visit = (n: RegionNode) => {
      if (n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)) {
        set.add(n.code);
        let cur: RegionNode | undefined = n;
        while (cur?.parentCode) {
          const par = nodeMap.get(cur.parentCode);
          if (!par) break;
          set.add(par.code);
          cur = par;
        }
      }
      n.children?.forEach(visit);
    };
    tree.forEach(visit);
    return set;
  }, [search, tree, nodeMap]);

  const toggle = (code: string, val: boolean) => {
    const node = nodeMap.get(code);
    if (!node) return;
    const codes = node.children ? node.descendantCodes : [code];
    setChecked((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => (val ? next.add(c) : next.delete(c)));
      return next;
    });
  };

  const parentState = (node: RegionNode): Tri => {
    if (!node.children) return checked.has(node.code) ? 'checked' : 'unchecked';
    const all = node.descendantCodes.every((c) => checked.has(c));
    const some = node.descendantCodes.some((c) => checked.has(c));
    return all ? 'checked' : some ? 'indeterminate' : 'unchecked';
  };

  const toggleExpand = (kind: 'p' | 'c', code: string) => {
    if (kind === 'p') {
      setExpandedP((prev) => {
        const next = new Set(prev);
        next.has(code) ? next.delete(code) : next.add(code);
        return next;
      });
    } else {
      setExpandedC((prev) => {
        const next = new Set(prev);
        next.has(code) ? next.delete(code) : next.add(code);
        return next;
      });
    }
  };

  const refresh = () => qc.invalidateQueries({ queryKey: QK.adminServiceAreas });

  // 派生有效状态：自身启用 且 所有已开通祖先均启用
  const derivedEffective = (area: ServiceArea, node: RegionNode): Effective => {
    if (!area.isActive) return 'self-off';
    const anc: string[] =
      node.level === 1 ? [] : node.level === 2 ? [node.provinceCode] : [node.provinceCode, node.cityCode ?? ''];
    for (const c of anc) {
      const a = openedByCode.get(c);
      if (a && !a.isActive) return 'parent-off';
    }
    return 'active';
  };

  // ---------------- 树：批量开通/关闭（Axis A: deletedAt） ----------------
  const handleSaveTree = async () => {
    const openedCodes = new Set(data.map((a) => a.code));
    const toCreate = [...checked].filter((c) => !openedCodes.has(c));
    const toDelete = data.filter((a) => !checked.has(a.code));
    if (!toCreate.length && !toDelete.length) {
      toast.info('没有变更');
      return;
    }
    setSaving(true);
    try {
      for (const code of toCreate) {
        const n = nodeMap.get(code);
        if (!n) continue;
        await createServiceArea({
          province: n.province,
          provinceCode: n.provinceCode,
          city: n.city,
          cityCode: n.cityCode,
          district: n.district,
          districtCode: n.districtCode,
          isActive: true,
          sort: 0,
        });
      }
      for (const a of toDelete) {
        await deleteServiceArea(a.id);
      }
      toast.success(`已开通 ${toCreate.length} 个、关闭 ${toDelete.length} 个区域`);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  // ---------------- 开通单个区域 ----------------
  const handleCreate = async (region: RegionValue) => {
    try {
      const created = await createServiceArea({
        province: region.province ?? '',
        provinceCode: region.provinceCode ?? '',
        city: region.city ?? undefined,
        cityCode: region.cityCode ?? undefined,
        district: region.district ?? undefined,
        districtCode: region.districtCode ?? undefined,
        isActive: true,
        sort: 0,
      });
      const code = created.code || regionCode(region);
      if (code) setChecked((prev) => new Set(prev).add(code));
      toast.success('区域已开通');
      setCreateOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  // ---------------- 启用/停用（Axis B: isActive，级联） ----------------
  const handleToggleActive = (area: ServiceArea, node: RegionNode) => {
    setActiveDialog({
      mode: area.isActive ? 'disable' : 'enable',
      area,
      node,
      cascade: false,
      loading: false,
    });
  };

  const confirmActive = async () => {
    if (!activeDialog) return;
    const { mode, area, cascade } = activeDialog;
    setActiveDialog((d) => (d ? { ...d, loading: true } : d));
    try {
      await setAreaActive(area.id, mode === 'enable', mode === 'enable' && cascade);
      toast.success(mode === 'enable' ? '已启用' : '已停用');
      setActiveDialog(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      setActiveDialog((d) => (d ? { ...d, loading: false } : d));
    }
  };

  const rtRow: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 0',
  };

  // 递归渲染树节点
  const renderNode = (node: RegionNode, depth: number) => {
    const visible = !matchedCodes || matchedCodes.has(node.code);
    if (!visible) return null;
    const opened = openedByCode.get(node.code);
    const isProv = depth === 0;
    const expandedSet = isProv ? expandedP : expandedC;
    const hasChildren = !!node.children?.length;
    const expanded = matchedCodes ? matchedCodes.has(node.code) : expandedSet.has(node.code);
    const childCount = node.descendantCodes.length - 1;

    return (
      <div key={node.code} style={{ paddingLeft: depth * 22 }}>
        <div style={rtRow}>
          <TriCheckbox state={parentState(node)} onChange={(v) => toggle(node.code, v)} />
          {hasChildren && (
            <button
              type="button"
              className="rt-toggle"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', width: 18 }}
              onClick={() => toggleExpand(isProv ? 'p' : 'c', node.code)}
            >
              {expanded ? '▾' : '▸'}
            </button>
          )}
          <span style={{ fontWeight: isProv ? 600 : 400 }}>{node.name}</span>
          {opened ? (
            <>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className={opened.isActive ? 'btn-link btn-link-danger' : 'btn-link'}
                onClick={() => handleToggleActive(opened, node)}
              >
                {opened.isActive ? '停用' : '启用'}
              </button>
              <EffectiveBadge kind={derivedEffective(opened, node)} />
            </>
          ) : (
            <span style={{ flex: 1 }} />
          )}
        </div>
        {expanded && hasChildren && node.children?.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="page-head">
        <h2>服务区域（开通城市字典）</h2>
        <button
          type="button"
          className="btn-primary btn-md"
          style={{ marginLeft: 'auto' }}
          onClick={() => setCreateOpen(true)}
        >
          + 开通单个区域
        </button>
      </div>

      <div
        className="card"
        style={{
          padding: 18,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <p className="field-hint" style={{ margin: 0, flex: 1, textAlign: 'left' }}>
            勾选即开通该行政区（省 / 市 / 区可自由配置）。勾选上级会自动勾选其下全部下级；取消勾选则整片关闭。配置完成后点击「保存开通区域」生效。开通后可在每行调整启停（停用向下传递整支，启用默认只开自身）。
          </p>
          <input
            className="input"
            style={{ width: 260, flexShrink: 0 }}
            placeholder="搜索省 / 市 / 区名称或编码"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div
          className="region-tree"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            border: '1px solid #eef1f4',
            borderRadius: 8,
            padding: 10,
          }}
        >
          {tree.map((p) => renderNode(p, 0))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="button" className="btn-primary" onClick={handleSaveTree} disabled={saving}>
            {saving ? '保存中…' : '保存开通区域'}
          </button>
          <span className="field-hint" style={{ margin: 0 }}>
            已勾选 {checked.size} 个区域，已开通 {data.length} 个
          </span>
        </div>
      </div>

      {createOpen && (
        <OpenAreaModal
          submitting={saving}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {activeDialog && (
        <ActiveDialog
          mode={activeDialog.mode}
          name={activeDialog.area.name}
          descendantCount={activeDialog.node.descendantCodes.length - 1}
          cascade={activeDialog.cascade}
          onCascadeChange={(v) => setActiveDialog((d) => (d ? { ...d, cascade: v } : d))}
          loading={activeDialog.loading}
          onCancel={() => setActiveDialog(null)}
          onConfirm={confirmActive}
        />
      )}
    </div>
  );
}
