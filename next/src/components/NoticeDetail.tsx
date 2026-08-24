'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPublicNotices, type NoticeScope } from '@/lib/admin-api';
import { getProfile } from '@/lib/api';
import { QK } from '@/lib/query-keys';
import { roleFromPath } from '@/lib/auth';
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

  const role = roleFromPath() ?? 'customer';
  const { data: profile } = useQuery({
    queryKey: QK.profile(role),
    queryFn: getProfile,
    staleTime: Infinity,
  });
  // 与 NoticeList 一致：用户/管理端仅所在地区；师傅端 = 所在地区 ∪ 接单范围
  const regions = useMemo(() => {
    if (!profile) return [];
    const arr: {
      provinceCode?: string;
      cityCode?: string;
      districtCode?: string;
    }[] = [];
    if (profile.provinceCode) {
      arr.push({
        provinceCode: profile.provinceCode,
        cityCode: profile.cityCode ?? undefined,
        districtCode: profile.districtCode ?? undefined,
      });
    }
    if (role === 'master') {
      const sa = profile.master?.serviceAreas;
      if (Array.isArray(sa)) {
        for (const r of sa) {
          if (r?.provinceCode) {
            arr.push({
              provinceCode: r.provinceCode,
              cityCode: r.cityCode ?? undefined,
              districtCode: r.districtCode ?? undefined,
            });
          }
        }
      }
    }
    return arr;
  }, [profile, role]);

  const { data, isLoading } = useQuery({
    queryKey: [...QK.publicNotices(scope), JSON.stringify(regions)],
    queryFn: () => getPublicNotices(scope, regions),
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
