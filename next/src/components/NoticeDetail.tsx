'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPublicNotices, type NoticeScope } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { formatDateTime } from '@/lib/format';
import { PortalNavSetter } from '@/components/PortalShell';
import SanitizedHtml from '@/components/admin/SanitizedHtml';

const SCOPE_BASE: Record<Exclude<NoticeScope, 'admin'>, string> = {
  customer: '/client',
  master: '/master',
};

// 公告详情：独立页面展示（替代原先的弹窗）。
// 复用公开公告列表接口按 id 取正文，无需新增后端端点。
export default function NoticeDetail({ scope }: { scope: Exclude<NoticeScope, 'admin'> }) {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const base = SCOPE_BASE[scope];

  const { data, isLoading } = useQuery({
    queryKey: QK.publicNotices(scope),
    queryFn: () => getPublicNotices(scope),
  });

  const notice = data?.find((n) => n.id === id);

  return (
    <>
      <PortalNavSetter title="公告详情" showBack backHref={`${base}/notices`} />
      <div className="laoma-container">
        <div className="card" style={{ padding: 20 }}>
          {isLoading && <div className="data-empty">加载中…</div>}
          {!isLoading && !notice && (
            <div className="data-empty">公告不存在或已下线下线</div>
          )}
          {notice && (
            <>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  margin: '0 0 6px',
                  color: 'var(--color-text)',
                  textAlign: 'center',
                }}
              >
                {notice.title}
              </h2>
              {notice.publishedAt && (
                <div
                  style={{
                    color: 'var(--color-text-soft)',
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  发布于 {formatDateTime(notice.publishedAt)}
                </div>
              )}
              {notice.contentHtml ? (
                <SanitizedHtml html={notice.contentHtml} />
              ) : (
                <div className="data-empty">该公告暂无正文内容</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
