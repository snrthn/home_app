'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  getAgreementDefault,
  type AgreementPublic,
  type AgreementScope,
  type AgreementType,
} from '@/lib/admin-api';
import { PortalNavSetter } from '@/components/PortalShell';
import SanitizedHtml from '@/components/admin/SanitizedHtml';
import { formatDateTime } from '@/lib/format';

// code 形如 `${scope}-${type}`，如 customer-registration / master-privacy
function resolveScopeType(code: string): { scope: string; type: string } | null {
  const idx = code.indexOf('-');
  if (idx <= 0 || idx === code.length - 1) return null;
  return { scope: code.slice(0, idx), type: code.slice(idx + 1) };
}

const SCOPE_LABEL: Record<AgreementScope, string> = {
  customer: '用户端',
  master: '师傅端',
  admin: '平台端',
};

// 应用内协议详情：渲染在 PortalShell 内，带 HeaderBar + 返回按钮，
// 与 NoticeDetail 一致，避免从「我的」点进来后丢失应用内导航（之前指向独立公开页 /agreements/[code]，无 HeaderBar）。
export default function AgreementDetail({ backHref }: { backHref: string }) {
  const params = useParams<{ code: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const resolved = resolveScopeType(code);

  const { data, isLoading } = useQuery<AgreementPublic | null>({
    queryKey: ['agreement', 'public', code],
    queryFn: () =>
      resolved
        ? getAgreementDefault(
            resolved.scope as AgreementScope,
            resolved.type as AgreementType,
          )
        : Promise.resolve(null),
    enabled: !!resolved,
  });

  return (
    <>
      <PortalNavSetter title={data?.title ?? '协议'} showBack backHref={backHref} />
      <div className="laoma-container">
        <div className="card" style={{ padding: 20 }}>
          {!resolved ? (
            <div className="data-empty">无效的协议地址</div>
          ) : isLoading ? (
            <div className="data-empty">加载中…</div>
          ) : !data ? (
            <div className="data-empty">该协议暂未发布</div>
          ) : (
            <>
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  margin: '0 0 6px',
                  color: 'var(--color-text)',
                  textAlign: 'center',
                }}
              >
                {data.title}
              </h1>
              <div
                style={{
                  color: 'var(--color-text-soft)',
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {SCOPE_LABEL[data.scope]} · 当前版本 v{data.version} · 最近更新{' '}
                {formatDateTime(data.updatedAt)}
              </div>
              {data.contentHtml ? (
                <SanitizedHtml html={data.contentHtml} />
              ) : (
                <div className="data-empty">该协议暂无正文内容</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
