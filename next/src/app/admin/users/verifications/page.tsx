'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPendingMasters,
  approveMaster,
  type MasterUser,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';

export default function VerificationPage() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { open: true; id: string; status: 'active' | 'disabled'; realName: string }
    | { open: false }
  >({ open: false });
  const toast = useToast();
  const qc = useQueryClient();

  // react-query 取数：同一 queryKey 的在途请求会被合并，避免初始化重复请求。
  const { data: rows = [], isLoading: loading } = useQuery<MasterUser[]>({
    queryKey: QK.adminPendingMasters,
    queryFn: getPendingMasters,
  });

  const openConfirm = (id: string, status: 'active' | 'disabled', realName: string) => {
    setDialog({ open: true, id, status, realName });
  };

  const closeDialog = () => setDialog({ open: false });

  const handleConfirm = async (reason?: string) => {
    if (!dialog.open) return;
    const { id, status } = dialog;
    setBusyId(id);
    try {
      await approveMaster(id, status, reason);
      toast.success(status === 'active' ? '已通过认证' : '已拒绝');
      // 审核后该师傅不再处于「待审核」列表，直接从缓存里移除（无需重新请求）
      qc.setQueryData<MasterUser[]>(QK.adminPendingMasters, (prev) =>
        (prev ?? []).filter((r) => r.id !== id),
      );
      // 师傅列表的状态也变了，标记为过期，下次进入自动刷新
      qc.invalidateQueries({ queryKey: QK.adminMasters });
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setBusyId(null);
      closeDialog();
    }
  };

  const columns: Column<MasterUser>[] = [
    { key: 'realName', title: '姓名', render: (r) => r.realName || '-' },
    { key: 'phone', title: '手机号', render: (r) => r.user?.phone || '-' },
    { key: 'city', title: '服务城市', render: (r) => r.city || '-' },
    { key: 'idCard', title: '身份证', render: (r) => r.idCard || '-' },
    { key: 'createdAt', title: '提交时间', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'action',
      title: '操作',
      align: 'center',
      width: '130px',
      render: (r) => (
        <div className="row-actions">
          <button
            className="btn-link"
            disabled={busyId === r.id}
            onClick={() => openConfirm(r.id, 'active', r.realName)}
          >
            通过
          </button>
          <button
            className="btn-link btn-link-danger"
            disabled={busyId === r.id}
            onClick={() => openConfirm(r.id, 'disabled', r.realName)}
          >
            拒绝
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <h2>认证审核</h2>
        <span className="page-sub">待审核师傅 {rows.length} 人</span>
      </div>
      <div className="card card--bare">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          emptyText="暂无待审核的师傅"
        />
      </div>

      <ConfirmDialog
        open={dialog.open}
        title={dialog.open && dialog.status === 'active' ? '确认通过认证？' : '确认拒绝认证？'}
        message={
          dialog.open
            ? `将对「${dialog.realName}」的师傅认证申请进行${
                dialog.status === 'active' ? '通过' : '拒绝'
              }操作，确认后不可撤销。`
            : undefined
        }
        confirmLabel={dialog.open && dialog.status === 'active' ? '确认通过' : '确认拒绝'}
        requireReason={dialog.open && dialog.status === 'disabled'}
        reasonLabel="拒绝理由"
        reasonPlaceholder="请输入拒绝原因，方便师傅修改后重新提交"
        loading={busyId !== null}
        onConfirm={handleConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
}
