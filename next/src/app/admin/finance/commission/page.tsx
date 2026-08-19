'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  getCommissionRules,
  upsertCommissionRule,
  deleteCommissionRule,
  previewCommission,
  type CommissionRule,
} from '@/lib/orders-api';
import { getServiceCategories, getServiceItems, type ServiceCategory, type ServiceItem } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { SelectInput } from '@/components/form/SelectInput';
import { Textarea } from '@/components/form/Textarea';
import { formatDateTime } from '@/lib/format';

// ---- 常量映射 ----
const SCOPE_LABEL: Record<string, string> = {
  global: '全局默认',
  category: '类目覆盖',
  service: '服务项覆盖',
};

const REFUND_POLICY_LABEL: Record<string, string> = {
  full: '全额退佣',
  tiered: '阶梯退款',
  keep_commission: '保佣退款',
};

const REFUND_POLICY_DESC: Record<string, string> = {
  full: '退款时忽略阶梯比例，退用户 100%，平台与师傅均无留成',
  tiered: '按区间断点确定退用户比例，留成按佣金率拆分平台/师傅',
  keep_commission: '平台佣金始终不退，优先保住佣金，余下留成给师傅',
};

/** 可取消状态的生命周期顺序（支付后→终态前），用于区间解析 */
const LIFECYCLE = [
  { key: 'pending_accept', label: '待接单' },
  { key: 'accepted', label: '已接单' },
  { key: 'departing', label: '出发上门中' },
  { key: 'arrived', label: '已到达' },
  { key: 'servicing', label: '服务中' },
  { key: 'pending_confirm', label: '待验收' },
];

/** 区间解析：给定状态，沿生命周期向前找最近断点，找不到默认 1（全额退） */
function resolveTierRatio(status: string, tiers: Record<string, number | string>): number {
  const idx = LIFECYCLE.findIndex((s) => s.key === status);
  if (idx < 0) return 1;
  for (let i = idx; i >= 0; i--) {
    const key = LIFECYCLE[i].key;
    if (key in tiers && tiers[key] !== '') {
      const n = Number(tiers[key]);
      if (!Number.isNaN(n)) return Math.min(100, Math.max(0, n)) / 100;
    }
  }
  return 1;
}

/** 按生命周期顺序排序 tier entries（JSON 对象 key 顺序不保证，统一排序避免保存/回显不一致） */
function sortedTierEntries<T>(tiers: Record<string, T>): [string, T][] {
  return Object.entries(tiers).sort((a, b) => {
    const ia = LIFECYCLE.findIndex((s) => s.key === a[0]);
    const ib = LIFECYCLE.findIndex((s) => s.key === b[0]);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

/** 将扁平类目列表构建为树 */
function buildCategoryTree(flat: ServiceCategory[]): (ServiceCategory & { children: (ServiceCategory & { children: unknown[] })[] })[] {
  type Node = ServiceCategory & { children: Node[] };
  const map = new Map<string, Node>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: Node[] = [];
  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/** 将树扁平化为带缩进前缀的 option 列表 */
function flattenCategoryOptions(
  nodes: ReturnType<typeof buildCategoryTree>,
  depth = 0,
  out: { id: string; label: string }[] = [],
): { id: string; label: string }[] {
  for (const n of nodes) {
    const prefix = depth > 0 ? '　'.repeat(depth) + '└ ' : '';
    out.push({ id: n.id, label: prefix + n.name });
    if (n.children.length > 0) {
      flattenCategoryOptions(n.children as ReturnType<typeof buildCategoryTree>, depth + 1, out);
    }
  }
  return out;
}

// ---- 弹窗表单状态 ----
interface FormState {
  scope: 'global' | 'category' | 'service';
  refId: string;
  platformRate: string; // 百分比输入 0~100
  refundPolicy: 'full' | 'tiered' | 'keep_commission';
  refundTiers: Record<string, string>; // 区间断点：key=状态, value=百分比 0~100
  isActive: boolean;
  note: string;
}

const emptyForm: FormState = {
  scope: 'global',
  refId: '',
  platformRate: '0',
  refundPolicy: 'tiered',
  refundTiers: { departing: '80', arrived: '50' },
  isActive: true,
  note: '',
};

export default function CommissionRulesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CommissionRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 试算
  const [previewItemId, setPreviewItemId] = useState('');
  const [previewAmount, setPreviewAmount] = useState('100');

  const { data: rules = [], isLoading } = useQuery<CommissionRule[]>({
    queryKey: QK.commissionRules,
    queryFn: () => getCommissionRules(),
    refetchOnMount: 'always',
  });

  const { data: categories = [] } = useQuery<ServiceCategory[]>({
    queryKey: ['admin', 'services', 'categories', 'flat'],
    queryFn: () => getServiceCategories(),
  });

  const { data: serviceItems = [] } = useQuery<ServiceItem[]>({
    queryKey: ['admin', 'services', 'items', 'all'],
    queryFn: () => getServiceItems(),
  });

  // 类目缩进下拉选项（树形→扁平+缩进前缀）
  const categoryOptions = useMemo(
    () => flattenCategoryOptions(buildCategoryTree(categories)),
    [categories],
  );

  const { data: preview } = useQuery({
    queryKey: ['commission', 'preview', previewItemId, previewAmount],
    queryFn: () => previewCommission(previewItemId, Number(previewAmount) || 100),
    enabled: !!previewItemId,
    staleTime: 0,
  });

  // 选择服务项后，自动用该服务的价格填充测算金额（用户仍可手动修改）
  useEffect(() => {
    if (!previewItemId || serviceItems.length === 0) return;
    const item = serviceItems.find((s) => s.id === previewItemId);
    if (item) {
      const priceNum = Number(item.price);
      if (!Number.isNaN(priceNum) && priceNum > 0) {
        setPreviewAmount(String(priceNum));
      }
    }
  }, [previewItemId, serviceItems]);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.commissionRules });

  // ---- 弹窗操作 ----
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (r: CommissionRule) => {
    setEditing(r);
    const tiers: Record<string, string> = {};
    if (r.refundTiers) {
      for (const [k, v] of sortedTierEntries(r.refundTiers)) {
        tiers[k] = String(Math.round(v * 100));
      }
    }
    setForm({
      scope: r.scope,
      refId: r.refId,
      platformRate: String(Math.round(r.platformRate * 100)),
      refundPolicy: r.refundPolicy,
      refundTiers: tiers,
      isActive: r.isActive,
      note: r.note ?? '',
    });
    setShowModal(true);
  };

  const submit = async () => {
    if (form.scope !== 'global' && !form.refId) {
      toast.error(form.scope === 'category' ? '请选择类目' : '请选择服务项');
      return;
    }
    const rate = Number(form.platformRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('平台佣金率需在 0~100 之间');
      return;
    }
    const tiersOut: Record<string, number> = {};
    if (form.refundPolicy === 'tiered') {
      for (const [k, v] of sortedTierEntries(form.refundTiers)) {
        const n = Number(v);
        if (v !== '' && !Number.isNaN(n) && n >= 0 && n <= 100) {
          tiersOut[k] = n / 100;
        }
      }
    }

    setSaving(true);
    try {
      await upsertCommissionRule({
        scope: form.scope,
        refId: form.scope === 'global' ? undefined : form.refId,
        platformRate: rate / 100,
        refundPolicy: form.refundPolicy,
        refundTiers: form.refundPolicy === 'tiered' ? tiersOut : null,
        isActive: form.isActive,
        note: form.note.trim() || undefined,
      });
      toast.success(editing ? '规则已更新' : '规则已创建');
      setShowModal(false);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCommissionRule(deleteTarget.id);
      toast.success('规则已删除');
      setDeleteTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setDeleting(false);
    }
  };

  // ---- 表格列 ----
  const columns: Column<CommissionRule>[] = [
    {
      key: 'scope',
      title: '作用范围',
      width: '110px',
      render: (r) => (
        <span style={{ fontWeight: 500 }}>{SCOPE_LABEL[r.scope] ?? r.scope}</span>
      ),
    },
    {
      key: 'refName',
      title: '作用对象',
      render: (r) => r.refName ?? (r.scope === 'global' ? '全平台默认' : '—'),
    },
    {
      key: 'platformRate',
      title: '平台佣金率',
      width: '110px',
      render: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--color-primary-text)' }}>
          {(r.platformRate * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'refundPolicy',
      title: '退款策略',
      width: '100px',
      render: (r) => REFUND_POLICY_LABEL[r.refundPolicy] ?? r.refundPolicy,
    },
    {
      key: 'isActive',
      title: '状态',
      width: '80px',
      render: (r) => (
        <span style={{ color: r.isActive ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
          {r.isActive ? '生效' : '停用'}
        </span>
      ),
    },
    {
      key: 'note',
      title: '备注',
      render: (r) => r.note ?? '—',
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      width: '150px',
      render: (r) => formatDateTime(r.updatedAt),
    },
    {
      key: '_actions',
      title: '操作',
      width: '130px',
      render: (r) => (
        <div className="row-actions">
          <button className="btn-link" onClick={() => openEdit(r)}>编辑</button>
          {r.scope !== 'global' && (
            <button className="btn-link btn-link-danger" onClick={() => setDeleteTarget(r)}>删除</button>
          )}
        </div>
      ),
    },
  ];

  // ---- 弹窗内表单辅助 ----
  /** 添加一个区间断点 */
  const addTier = () => {
    // 找一个还没被用的状态
    const used = new Set(Object.keys(form.refundTiers));
    const next = LIFECYCLE.find((s) => !used.has(s.key));
    if (!next) {
      toast.error('所有状态都已添加断点');
      return;
    }
    setForm((f) => ({ ...f, refundTiers: { ...f.refundTiers, [next.key]: '100' } }));
  };

  /** 删除一个区间断点 */
  const removeTier = (key: string) => {
    setForm((f) => {
      const next = { ...f.refundTiers };
      delete next[key];
      return { ...f, refundTiers: next };
    });
  };

  /** 更新断点状态 key（切换到另一个状态） */
  const changeTierKey = (oldKey: string, newKey: string) => {
    setForm((f) => {
      const next = { ...f.refundTiers };
      const val = next[oldKey];
      delete next[oldKey];
      next[newKey] = val ?? '100';
      return { ...f, refundTiers: next };
    });
  };

  /** 弹窗内各状态解析后的实际退款比例（区间语义预览） */
  const resolvedRatios = useMemo(() => {
    return LIFECYCLE.map((s) => ({
      label: s.label,
      ratio: resolveTierRatio(s.key, form.refundTiers),
    }));
  }, [form.refundTiers]);

  return (
    <div>
      {/* 页头：标题左 + 新增按钮右（项目规范：marginLeft:auto 右对齐） */}
      <div className="page-head">
        <h2>分账规则</h2>
        <button
          className="btn-primary btn-md"
          style={{ marginLeft: 'auto' }}
          onClick={openCreate}
        >
          + 新增规则
        </button>
      </div>
      <p className="page-sub" style={{ marginBottom: 16 }}>
        配置平台与师傅的分账比例及退款佣金策略。优先级：服务项 {'>'} 类目 {'>'} 全局默认；下单时自动解析并固化进订单快照。
      </p>

      {/* 规则列表 */}
      <div className="data-table-wrap">
        <DataTable
          columns={columns}
          rows={rules}
          rowKey={(r) => r.id}
          loading={isLoading}
          emptyText="暂无分账规则，未配置时使用内置默认（佣金率 0%、阶梯退款 departing 退80%/arrived 退50%）"
        />
      </div>

      {/* 试算面板 */}
      <div className="data-table-wrap" style={{ marginTop: 16 }}>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>规则试算</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <select
              className="input select-input"
              style={{ width: 260 }}
              value={previewItemId}
              onChange={(e) => setPreviewItemId(e.target.value)}
            >
              <option value="">选择服务项试算…</option>
              {serviceItems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（¥{s.price}/{s.unit ?? '次'}）
                </option>
              ))}
            </select>
            <input
              className="input"
              style={{ width: 120 }}
              type="number"
              min="0"
              placeholder="订单金额"
              value={previewAmount}
              onChange={(e) => setPreviewAmount(e.target.value)}
            />
          </div>
          {preview && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {/* 生效规则 */}
              <div style={{ padding: 14, background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>生效规则</div>
                <div className="field-inline-row">
                  <span className="field-label">规则来源</span>
                  <span className="field-inline-value">{preview.snapshot.source}</span>
                </div>
                <div className="field-inline-row">
                  <span className="field-label">平台佣金率</span>
                  <span className="field-inline-value">{(preview.snapshot.platformRate * 100).toFixed(1)}%</span>
                </div>
                <div className="field-inline-row">
                  <span className="field-label">退款策略</span>
                  <span className="field-inline-value">{REFUND_POLICY_LABEL[preview.snapshot.refundPolicy] ?? preview.snapshot.refundPolicy}</span>
                </div>
              </div>
              {/* 验收分账 */}
              <div style={{ padding: 14, background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>验收分账</div>
                <div className="field-inline-row">
                  <span className="field-label">订单金额</span>
                  <span className="field-inline-value">¥{previewAmount || '100'}</span>
                </div>
                <div className="field-inline-row">
                  <span className="field-label">平台佣金</span>
                  <span className="field-inline-value" style={{ color: 'var(--color-primary-text)' }}>¥{preview.normal.platformFee}</span>
                </div>
                <div className="field-inline-row">
                  <span className="field-label">师傅所得</span>
                  <span className="field-inline-value" style={{ color: 'var(--color-success)' }}>¥{preview.normal.masterAmount}</span>
                </div>
              </div>
              {/* 退款分账 — 根据退款策略动态生成 */}
              {preview.snapshot.refundPolicy === 'full' ? (
                <div style={{ padding: 14, background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', gridColumn: '1 / -1' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>退款分账</div>
                  <p className="field-hint" style={{ margin: 0 }}>
                    当前退款策略为「全额退佣」——取消订单时无论处于哪个阶段，均向用户退还 100% 款项，平台与师傅均无留成。
                    如需按服务阶段差异化退款，请将退款策略改为「阶梯退款」并配置区间断点。
                  </p>
                </div>
              ) : (
              preview.refunds.map((rf) => {
                const label = LIFECYCLE.find((t) => t.key === rf.status)?.label ?? rf.status;
                return (
                  <div key={rf.status} style={{ padding: 14, background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{label}时取消</div>
                    <div className="field-inline-row">
                      <span className="field-label">退用户</span>
                      <span className="field-inline-value" style={{ color: 'var(--color-danger)' }}>¥{rf.refundAmount}</span>
                    </div>
                    <div className="field-inline-row">
                      <span className="field-label">平台留成</span>
                      <span className="field-inline-value">¥{rf.platformKeep}</span>
                    </div>
                    <div className="field-inline-row">
                      <span className="field-label">师傅补偿</span>
                      <span className="field-inline-value">¥{rf.masterCompensation}</span>
                    </div>
                  </div>
                );
              })
              )}
            </div>
          )}
        </div>
      </div>

      {/* 新增/编辑弹窗（加宽至 lg=760px） */}
      <Modal
        open={showModal}
        title={editing ? '编辑分账规则' : '新增分账规则'}
        width="lg"
        onClose={() => setShowModal(false)}
        footer={
          <>
            <button className="btn-link" onClick={() => setShowModal(false)}>取消</button>
            <button className="btn-primary" disabled={saving} onClick={submit}>
              {saving ? '保存中…' : '保存'}
            </button>
          </>
        }
      >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 作用范围 */}
            <div className="field-inline-row">
              <span className="field-label" style={{ minWidth: 80 }}>作用范围</span>
              <SelectInput
                value={form.scope}
                onChange={(e) => {
                  const scope = e.target.value as FormState['scope'];
                  setForm((f) => ({ ...f, scope, refId: '' }));
                }}
                style={{ flex: 1 }}
              >
                <option value="global">全局默认</option>
                <option value="category">类目覆盖</option>
                <option value="service">服务项覆盖</option>
              </SelectInput>
            </div>

            {/* 作用对象（非 global） */}
            {form.scope === 'category' && (
              <div className="field-inline-row">
                <span className="field-label" style={{ minWidth: 80 }}>选择类目</span>
                <SelectInput
                  value={form.refId}
                  onChange={(e) => setForm((f) => ({ ...f, refId: e.target.value }))}
                  style={{ flex: 1 }}
                >
                  <option value="">请选择…</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </SelectInput>
              </div>
            )}
            {form.scope === 'service' && (
              <div className="field-inline-row">
                <span className="field-label" style={{ minWidth: 80 }}>选择服务项</span>
                <SelectInput
                  value={form.refId}
                  onChange={(e) => setForm((f) => ({ ...f, refId: e.target.value }))}
                  style={{ flex: 1 }}
                >
                  <option value="">请选择…</option>
                  {serviceItems.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </SelectInput>
              </div>
            )}

            {/* 平台佣金率 */}
            <div className="field-inline-row">
              <span className="field-label" style={{ minWidth: 80 }}>平台佣金率</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.platformRate}
                  onChange={(e) => setForm((f) => ({ ...f, platformRate: e.target.value }))}
                  style={{ width: 120 }}
                />
                <span className="field-hint">%（师傅得 {100 - (Number(form.platformRate) || 0)}%）</span>
              </div>
            </div>

            {/* 退款策略 */}
            <div className="field-inline-row">
              <span className="field-label" style={{ minWidth: 80 }}>退款策略</span>
              <SelectInput
                value={form.refundPolicy}
                onChange={(e) => setForm((f) => ({ ...f, refundPolicy: e.target.value as FormState['refundPolicy'] }))}
                style={{ flex: 1 }}
              >
                <option value="tiered">阶梯退款（默认）</option>
                <option value="full">全额退佣</option>
                <option value="keep_commission">保佣退款</option>
              </SelectInput>
            </div>
            <p className="field-hint" style={{ marginLeft: 80 }}>
              {REFUND_POLICY_DESC[form.refundPolicy]}
            </p>

            {/* 阶梯区间断点（仅 tiered） */}
            {form.refundPolicy === 'tiered' && (
              <div style={{ marginLeft: 80 }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>退款区间断点</div>
                <p className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                  每个「从某状态起」定义一个退用户的比例断点；后续未定义的状态自动继承上一个断点，直到遇到下一个断点。
                </p>
                {/* 断点列表 */}
                {Object.entries(form.refundTiers).length === 0 && (
                  <p className="field-hint" style={{ marginBottom: 8 }}>暂无断点，所有状态默认退 100%</p>
                )}
                {sortedTierEntries(form.refundTiers).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-soft)' }}>从</span>
                    <select
                      className="input select-input"
                      style={{ width: 130 }}
                      value={key}
                      onChange={(e) => changeTierKey(key, e.target.value)}
                    >
                      {LIFECYCLE.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: 13, color: 'var(--color-text-soft)' }}>起 → 退</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      value={val}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        refundTiers: { ...f.refundTiers, [key]: e.target.value },
                      }))}
                      style={{ width: 70 }}
                      placeholder="100"
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>%</span>
                    <button
                      className="btn-link btn-link-danger"
                      onClick={() => removeTier(key)}
                      style={{ marginLeft: 4 }}
                    >删除</button>
                  </div>
                ))}
                {Object.keys(form.refundTiers).length < LIFECYCLE.length && (
                  <button className="btn-link" onClick={addTier} style={{ marginTop: 4 }}>
                    + 添加断点
                  </button>
                )}

                {/* 区间解析预览：各状态实际退款比例 */}
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-soft)', marginBottom: 6 }}>
                    各状态实际退款比例（区间自动解析）
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                    {resolvedRatios.map((r) => (
                      <span key={r.label} style={{ fontSize: 12 }}>
                        {r.label}{' '}
                        <strong style={{ color: r.ratio === 1 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {Math.round(r.ratio * 100)}%
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 启停 */}
            <div className="field-inline-row">
              <span className="field-label" style={{ minWidth: 80 }}>状态</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <span style={{ fontSize: 14 }}>{form.isActive ? '生效中' : '已停用'}</span>
              </label>
            </div>

            {/* 备注 */}
            <div className="field-inline-row">
              <span className="field-label" style={{ minWidth: 80 }}>备注</span>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="选填，如「战略合作伙伴特殊费率」"
                rows={2}
                style={{ flex: 1 }}
              />
            </div>
          </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除分账规则"
        message={`确认删除「${SCOPE_LABEL[deleteTarget?.scope ?? ''] ?? ''} - ${deleteTarget?.refName ?? ''}」规则？删除后该层级将回退到上级规则。`}
        confirmLabel="删除"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
