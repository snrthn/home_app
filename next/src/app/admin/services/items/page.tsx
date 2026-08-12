'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getServiceItems,
  getServiceCategories,
  createServiceItem,
  updateServiceItem,
  deleteServiceItem,
  type ServiceItem,
  type ServiceCategory,
  type ServiceTypeValue,
  SERVICE_TYPE_LABEL,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { StatusBadge } from '@/components/admin/DataTable';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RegionCascader } from '@/components/form/RegionCascader';
import { SelectInput } from '@/components/form/SelectInput';
import { CoverImageField } from '@/components/form/CoverImageField';
import { regionText, type RegionValue } from '@/data/region';

interface ItemDraft {
  categoryId: string;
  name: string;
  type: ServiceTypeValue;
  region: RegionValue;
  price: string;
  unit: string;
  estimatedDuration: string;
  coverImage: string;
  description: string;
  sort: string;
  isActive: boolean;
}

const EMPTY_DRAFT: ItemDraft = {
  categoryId: '',
  name: '',
  type: 'clean',
  region: {},
  price: '',
  unit: '',
  estimatedDuration: '',
  coverImage: '',
  description: '',
  sort: '0',
  isActive: true,
};

function ItemEditModal({
  title,
  initial,
  categories,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: ItemDraft;
  categories: ServiceCategory[];
  onClose: () => void;
  onSubmit: (dto: ItemDraft) => Promise<void>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<ItemDraft>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    if (!draft.categoryId) {
      toast.warning('请选择所属类目');
      return;
    }
    if (!draft.name.trim()) {
      toast.warning('请填写服务项目名称');
      return;
    }
    if (!draft.price || Number(draft.price) < 0 || Number.isNaN(Number(draft.price))) {
      toast.warning('请填写合法的价格');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(draft);
      onClose();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-lg">
        <div className="modal-header">
          <span>{title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="field-label">所属类目</label>
              <SelectInput
                value={draft.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
              >
                <option value="">请选择类目</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="field-label">服务类型</label>
              <SelectInput
                value={draft.type}
                onChange={(e) => set('type', e.target.value as ServiceTypeValue)}
              >
                {(Object.keys(SERVICE_TYPE_LABEL) as ServiceTypeValue[]).map((t) => (
                  <option key={t} value={t}>
                    {SERVICE_TYPE_LABEL[t]}
                  </option>
                ))}
              </SelectInput>
            </div>
          </div>

          <div className="field">
            <label className="field-label">服务项目名称</label>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="如：空调深度清洗 / 洗衣机拆洗"
            />
          </div>

          <div className="field">
            <label className="field-label">服务区域（留空表示全城可服务）</label>
            <RegionCascader value={draft.region} onChange={(v) => set('region', v)} />
          </div>

          <div className="field-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label className="field-label">价格（元）</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={draft.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="如：199.00"
              />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label className="field-label">计价单位（可选）</label>
              <input
                className="input"
                value={draft.unit}
                onChange={(e) => set('unit', e.target.value)}
                placeholder="如：次 / 台 / 平米"
              />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label className="field-label">预计时长（分钟，可选）</label>
              <input
                className="input"
                type="number"
                min="0"
                value={draft.estimatedDuration}
                onChange={(e) => set('estimatedDuration', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">封面图（可选，建议 16:9）</label>
            <CoverImageField value={draft.coverImage} onChange={(v) => set('coverImage', v)} />
          </div>

          <div className="field">
            <label className="field-label">描述（可选）</label>
            <textarea
              className="input"
              style={{ minHeight: 56 }}
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="field-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="field-label">排序（越小越靠前）</label>
              <input
                className="input"
                type="number"
                value={draft.sort}
                onChange={(e) => set('sort', e.target.value)}
              />
            </div>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              启用（前端可下单）
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServiceItemsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data: items = [], isLoading: loading } = useQuery<ServiceItem[]>({
    queryKey: QK.adminServiceItems,
    queryFn: () => getServiceItems(),
  });

  const { data: categories = [] } = useQuery<ServiceCategory[]>({
    queryKey: QK.adminServiceCategories,
    queryFn: () => getServiceCategories(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ServiceItem | null>(null);
  const [confirm, setConfirm] = useState<ServiceItem | null>(null);
  const [acting, setActing] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.adminServiceItems });

  const buildDto = (d: ItemDraft) => ({
    categoryId: d.categoryId,
    name: d.name.trim(),
    type: d.type,
    province: d.region.province ?? undefined,
    provinceCode: d.region.provinceCode ?? undefined,
    city: d.region.city ?? undefined,
    cityCode: d.region.cityCode ?? undefined,
    district: d.region.district ?? undefined,
    districtCode: d.region.districtCode ?? undefined,
    price: Number(d.price),
    unit: d.unit.trim() || undefined,
    estimatedDuration: d.estimatedDuration ? Number(d.estimatedDuration) : undefined,
    coverImage: d.coverImage.trim() || undefined,
    description: d.description.trim() || undefined,
    sort: Number(d.sort),
    isActive: d.isActive,
  });

  const handleCreate = async (dto: ItemDraft) => {
    try {
      await createServiceItem(buildDto(dto));
      toast.success('服务项目已创建');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleUpdate = async (id: string, dto: ItemDraft) => {
    try {
      await updateServiceItem(id, buildDto(dto));
      toast.success('服务项目已保存');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setActing(true);
    try {
      await deleteServiceItem(confirm.id);
      toast.success('服务项目已删除');
      setConfirm(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  const toDraft = (it: ServiceItem): ItemDraft => ({
    categoryId: it.categoryId,
    name: it.name,
    type: it.type,
    region: {
      province: it.province,
      provinceCode: it.provinceCode,
      city: it.city,
      cityCode: it.cityCode,
      district: it.district,
      districtCode: it.districtCode,
    },
    price: String(it.price),
    unit: it.unit ?? '',
    estimatedDuration: it.estimatedDuration != null ? String(it.estimatedDuration) : '',
    coverImage: it.coverImage ?? '',
    description: it.description ?? '',
    sort: String(it.sort),
    isActive: it.isActive,
  });

  const columns: Column<ServiceItem>[] = [
    { key: 'name', title: '项目名称', width: '220px', render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'category', title: '类目', width: '240px', render: (r) => r.category?.name ?? <span style={{ color: '#b6c0c8' }}>—</span> },
    { key: 'type', title: '类型', width: '90px', render: (r) => SERVICE_TYPE_LABEL[r.type] ?? r.type },
    {
      key: 'region',
      title: '服务区域',
      width: '170px',
      render: (r) =>
        r.provinceCode ? (
          <span
            className="cell-ellipsis"
            title={regionText({ provinceCode: r.provinceCode, cityCode: r.cityCode, districtCode: r.districtCode })}
          >
            {regionText({ provinceCode: r.provinceCode, cityCode: r.cityCode, districtCode: r.districtCode })}
          </span>
        ) : (
          <span style={{ color: '#b6c0c8' }}>全城</span>
        ),
    },
    {
      key: 'price',
      title: '价格',
      width: '110px',
      render: (r) => <span>¥{r.price}</span>,
    },
    {
      key: 'duration',
      title: '时长',
      width: '90px',
      render: (r) => (r.estimatedDuration != null ? `${r.estimatedDuration}分` : '—'),
    },
    {
      key: 'isActive',
      title: '状态',
      width: '90px',
      render: (r) => (
        <StatusBadge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? '启用' : '停用'}</StatusBadge>
      ),
    },
    {
      key: 'op',
      title: '操作',
      width: '130px',
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="btn-link" onClick={() => setEditItem(r)}>
            编辑
          </button>
          <button
            type="button"
            className="btn-link btn-link-danger"
            onClick={() => setConfirm(r)}
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <h2>服务项目</h2>
        <button
          type="button"
          className="btn-primary btn-md"
          style={{ marginLeft: 'auto' }}
          onClick={() => setCreateOpen(true)}
        >
          + 新增项目
        </button>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <p className="field-hint" style={{ marginTop: -4, marginBottom: 14 }}>
          服务项目挂在具体类目下，是客户下单时真正选择的对象。价格在下单时会被快照进订单（serviceSnapshot），后续改价不影响历史订单；所属区域、类型、预计时长用于派单与排期。
        </p>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={loading}
          emptyText="暂无服务项目，点击右上角「新增项目」开始维护"
        />
      </div>

      {createOpen && (
        <ItemEditModal
          title="新增服务项目"
          initial={EMPTY_DRAFT}
          categories={categories}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {editItem && (
        <ItemEditModal
          key={editItem.id}
          title={`编辑项目 · ${editItem.name}`}
          initial={toDraft(editItem)}
          categories={categories}
          onClose={() => setEditItem(null)}
          onSubmit={(dto) => handleUpdate(editItem.id, dto)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title="删除该项目"
        message="删除后该项目不再对客户可见（历史订单不受影响），确定删除？"
        confirmLabel="确认删除"
        loading={acting}
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
