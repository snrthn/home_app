'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  getAgreementDefault,
  type AgreementPublic,
  type AgreementScope,
  type AgreementType,
} from '@/lib/admin-api';
import SanitizedHtml from '@/components/admin/SanitizedHtml';
import { formatDateTime } from '@/lib/format';

// code 形如 `${scope}-${type}`，如 admin-registration / customer-privacy
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

export default function AgreementPublicPage() {
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

  const router = useRouter();
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="agreement-public">
      <div className="agreement-public-inner">
        {!resolved ? (
          <div className="card agreement-public-empty">无效的协议地址</div>
        ) : isLoading ? (
          <div className="card agreement-public-empty">加载中…</div>
        ) : !data ? (
          <div className="card agreement-public-empty">该协议暂未发布</div>
        ) : (
          <>
            <div className="agreement-title-row">
              <button
                type="button"
                className="agreement-back"
                onClick={handleBack}
                aria-label="返回"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 18l-6-6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                返回
              </button>
              <h1 className="agreement-public-title">{data.title}</h1>
            </div>
            <div className="agreement-public-meta">
              {SCOPE_LABEL[data.scope]} · 当前版本 v{data.version} · 最近更新{' '}
              {formatDateTime(data.updatedAt)}
            </div>
            <article className="agreement-public-content">
              <SanitizedHtml html={data.contentHtml} />
            </article>
          </>
        )}
      </div>
    </div>
  );
}
