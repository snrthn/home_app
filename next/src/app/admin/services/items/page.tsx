'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getServiceItems,
  createServiceItem,
  updateServiceItem,
  deleteServiceItem,
  type ServiceItem,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { StatusBadge } from '@/components/admin/DataTable';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CategoryCascader } from '@/components/form/CategoryCascader';
import { CoverImageField } from '@/components/form/CoverImageField';
import RichTextEditor from '@/components/admin/RichTextEditor';
import { useEscClose } from '@/lib/useEscClose';

interface ItemDraft {
  categoryId: string;
  name: string;
  price: string;
  unit: string;
  estimatedDuration: string;
  coverImage: string;
  description: string;
  sort: string;
  isActive: boolean;
}

// 富文本空内容（仅占位标签 / 纯空白）归一为 undefined，避免详情页渲染出空「服务介绍」区块
function normRichText(html?: string): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const isEmpty = text.length === 0 && !/<(img|table|video)[^>]*>/i.test(html);
  return isEmpty ? undefined : html;
}

const EMPTY_DRAFT: ItemDraft = {
  categoryId: '',
  name: '',
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
  onClose,
  onSubmit,
}: {
  title: string;
  initial: ItemDraft;
  onClose: () => void;
  onSubmit: (dto: ItemDraft) => Promise<void>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<ItemDraft>(initial);
  const [saving, setSaving] = useState(false);

  // Esc 关闭弹窗
  useEscClose(onClose);
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    if (!draft.categoryId) {
      toast.warning('请选择服务类目（三级联动定位到具体服务）');
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
          <div className="field">
            <label className="field-label">服务类目（三级联动定位）</label>
            <CategoryCascader value={draft.categoryId} onChange={(id) => set('categoryId', id)} />
            <p className="field-hint" style={{ marginTop: 6 }}>
              按「业务域 → 子类目 → 具体服务」三级选择，定位到最具体的服务节点。服务类型（工种）由所选业务域自动派生，无需单独选择。
            </p>
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
            <label className="field-label">服务介绍（富文本，可选）</label>
            <RichTextEditor
              value={draft.description}
              onChange={(html) => set('description', html)}
              placeholder="可写服务流程、包含项目、注意事项等，支持加粗、标题、列表、图片…"
            />
            <p className="field-hint" style={{ marginTop: 6 }}>
              支持图文混排；图片会上传并内联展示。列表页不展示正文，但客户端详情页会完整渲染。
            </p>
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

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ServiceItem | null>(null);
  const [confirm, setConfirm] = useState<ServiceItem | null>(null);
  const [acting, setActing] = useState(false);

  // 项目增删改会影响类目页的「项目数」统计，一并失效类目缓存
  const refresh = () => {
    qc.invalidateQueries({ queryKey: QK.adminServiceItems });
    qc.invalidateQueries({ queryKey: QK.adminServiceCategories });
  };

  const buildDto = (d: ItemDraft) => ({
    categoryId: d.categoryId,
    name: d.name.trim(),
    price: Number(d.price),
    unit: d.unit.trim() || undefined,
    estimatedDuration: d.estimatedDuration ? Number(d.estimatedDuration) : undefined,
    coverImage: d.coverImage.trim() || undefined,
    description: normRichText(d.description),
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
          服务项目挂在具体类目（业务域 → 子类目 → 具体服务）下，是客户下单时真正选择的对象。服务本身是「模板」，不绑定区域；下单时的可用性由「平台开通区域 ∩ 师傅接单范围 ∩ 客户下单地址」在运行时动态判定。价格在下单时快照进订单（serviceSnapshot），后续改价不影响历史订单；服务类型（工种）由所属业务域自动派生，用于派单与统计。
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
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {editItem && (
        <ItemEditModal
          key={editItem.id}
          title={`编辑项目 · ${editItem.name}`}
          initial={toDraft(editItem)}
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
