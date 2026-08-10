'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  getPublicNotices,
  type NoticePublic,
  type NoticeScope,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { formatDateTime } from '@/lib/format';

const SCOPE_BASE: Record<Exclude<NoticeScope, 'admin'>, string> = {
  customer: '/client',
  master: '/master',
};

function PinIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--color-primary)' }}
    >
      <path d="M12 17v5" />
      <path d="M9 10.76V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6.76l2 3.24H7l2-3.24Z" />
    </svg>
  );
}

// 公告列表：点击跳转到独立详情页（/client|master/notices/[id]），不再使用弹窗。
export default function NoticeList({ scope }: { scope: NoticeScope }) {
  const { data: notices = [], isLoading } = useQuery<NoticePublic[]>({
    queryKey: QK.publicNotices(scope),
    queryFn: () => getPublicNotices(scope),
  });

  if (isLoading) {
    return <div className="card">加载中…</div>;
  }

  if (notices.length === 0) {
    return <div className="card data-empty">暂无公告</div>;
  }

  const base = SCOPE_BASE[scope as Exclude<NoticeScope, 'admin'>] ?? '/client';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {notices.map((n) => (
        <Link
          key={n.id}
          href={`${base}/notices/${n.id}`}
          className="card"
          style={{
            textAlign: 'left',
            cursor: 'pointer',
            padding: 16,
            border: '1px solid #eef0f2',
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {n.pinned && <PinIcon />}
            <span style={{ fontWeight: 600, fontSize: 15 }}>{n.title}</span>
          </div>
          {n.summary && (
            <div style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 6 }}>
              {n.summary}
            </div>
          )}
          <div style={{ color: '#9aa7b2', fontSize: 12 }}>
            {n.publishedAt ? `发布于 ${formatDateTime(n.publishedAt)}` : ''}
          </div>
        </Link>
      ))}
    </div>
  );
}
