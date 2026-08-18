'use client';

import { useQuery } from '@tanstack/react-query';
import { getSiteContent } from '@/lib/admin-api';
import type { AboutRole } from '@/lib/about-content';
import { QK } from '@/lib/query-keys';
import SanitizedHtml from '@/components/admin/SanitizedHtml';
import EmptyState from '@/components/EmptyState';

const ABOUT_KEY: Record<AboutRole, string> = {
  customer: 'about_customer',
  master: 'about_master',
  admin: 'about_admin',
};

// 关于我们展示：动态读取后端维护内容；无数据时显示空占位，不再内置兜底文案。
export default function AboutContent({ role }: { role: AboutRole }) {
  const { data, isLoading } = useQuery({
    queryKey: QK.siteContent(ABOUT_KEY[role]),
    queryFn: () => getSiteContent(ABOUT_KEY[role]),
  });

  if (isLoading) {
    return (
      <div className="card about-empty">
        <p>加载中…</p>
      </div>
    );
  }

  if (!data || !data.contentHtml || !data.contentHtml.trim()) {
    return (
      <div className="card about-empty">
        <EmptyState text="暂无内容" />
      </div>
    );
  }

  return (
    <div className="about-detail">
      <h1 className="about-title">{data.title || '关于我们'}</h1>
      <article className="agreement-public-content">
        <SanitizedHtml html={data.contentHtml} />
      </article>
    </div>
  );
}
