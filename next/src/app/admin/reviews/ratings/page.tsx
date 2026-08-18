'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getReviews, type ReviewItem } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import DataTable, { type Column } from '@/components/admin/DataTable';

export default function AdminReviewsPage() {
  const { data: list = [], isLoading } = useQuery<ReviewItem[]>({
    queryKey: QK.adminReviews,
    queryFn: () => getReviews(),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const columns = useMemo<Column<ReviewItem>[]>(
    () => [
      {
        key: 'orderNo',
        title: '订单号',
        width: '170px',
        render: (r) => r.order?.orderNo ?? '-',
      },
      {
        key: 'customer',
        title: '评价客户',
        width: '120px',
        render: (r) => (r.anonymous ? '匿名' : r.customer?.profile?.nickname ?? '-'),
      },
      {
        key: 'master',
        title: '师傅',
        width: '120px',
        render: (r) => r.master?.realName ?? r.master?.user?.profile?.nickname ?? '-',
      },
      {
        key: 'rating',
        title: '星级',
        width: '140px',
        render: (r) => (
          <span style={{ color: '#f5a623', letterSpacing: 2 }}>
            {'★'.repeat(r.rating)}
            <span style={{ color: 'var(--color-muted)' }}>{'★'.repeat(5 - r.rating)}</span>
          </span>
        ),
      },
      {
        key: 'comment',
        title: '评价内容',
        render: (r) =>
          r.comment ? (
            <span className="cell-ellipsis" title={r.comment}>{r.comment}</span>
          ) : (
            <span className="field-hint">未填写</span>
          ),
      },
      {
        key: 'createdAt',
        title: '评价时间',
        width: '160px',
        render: (r) => (r.createdAt ? r.createdAt.slice(0, 19).replace('T', ' ') : '-'),
      },
    ],
    [],
  );

  return (
    <>
      <div className="page-head">
        <h2>评价列表</h2>
      </div>

      <p className="field-hint" style={{ marginTop: -4, marginBottom: 12 }}>
        客户对已完成订单的评价记录；评价提交后自动计入师傅评分（均值）与完单量。匿名评价不展示客户身份。
      </p>

      <DataTable
        columns={columns}
        rows={list}
        rowKey={(r) => r.id}
        loading={isLoading}
        emptyText="暂无评价记录"
      />
    </>
  );
}
