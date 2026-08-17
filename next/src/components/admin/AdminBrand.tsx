'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGlobalConfig } from '@/lib/global-config';
import { resolveAsset } from '@/lib/api';
import { getSiteContent } from '@/lib/admin-api';
import { getAbout, aboutToHtml } from '@/lib/about-content';
import { QK } from '@/lib/query-keys';
import SanitizedHtml from '@/components/admin/SanitizedHtml';
import { Modal } from '@/components/Modal';

// 运营端顶栏品牌：左侧 Logo（配置则展示，无则不展示）+ 系统名称。
// 数据来自全局配置，改系统名称 / Logo 后刷新即生效。
// 点击整个品牌（Logo + 标题）弹出「关于我们」窗口，展示运营端关于信息。
export default function AdminBrand() {
  const { siteName, logoUrl } = useGlobalConfig();
  const name = siteName || '老马家电';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = `${name} · 管理后台`;
  }, [name]);

  return (
    <>
      <button
        type="button"
        className="admin-brand admin-brand-btn"
        onClick={() => setOpen(true)}
        title="查看关于我们"
        aria-label="关于我们"
      >
        {logoUrl ? (
          <img
            src={resolveAsset(logoUrl)}
            alt={name}
            className="admin-brand-logo"
          />
        ) : null}
        <span>{name} · 管理后台</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`关于 ${name}`}
        width="md"
      >
        <AdminAboutBody />
      </Modal>
    </>
  );
}

// 运营端「关于我们」正文：动态读取后端 about_admin 内容；
// 无数据时回退到静态占位文案，保证弹出窗口始终有内容。
function AdminAboutBody() {
  const { data, isLoading } = useQuery({
    queryKey: QK.siteContent('about_admin'),
    queryFn: () => getSiteContent('about_admin'),
  });

  if (isLoading) {
    return <p className="field-hint">加载中…</p>;
  }

  const def = getAbout('admin');
  const html = data?.contentHtml?.trim() ? data.contentHtml : aboutToHtml(def);
  const title = data?.title?.trim() ? data.title : def.title;

  return (
    <div className="about-popover">
      <h1 className="about-title">{title}</h1>
      <article className="agreement-public-content">
        <SanitizedHtml html={html} />
      </article>
    </div>
  );
}
