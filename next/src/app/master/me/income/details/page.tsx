'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PortalNavSetter } from '@/components/PortalShell';
import EmptyState from '@/components/EmptyState';
import { getMyIncomeDetails, type Settlement } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { formatDateTime } from '@/lib/format';

const ST_STATUS: Record<string, { label: string; color: string }> = {
  credited: { label: '已入账', color: 'var(--color-success)' },
  pending: { label: '待审核', color: 'var(--color-warning)' },
  rejected: { label: '已驳回', color: 'var(--color-danger)' },
};

function fmtTime(t?: string | null) {
  return formatDateTime(t);
}

export default function MasterIncomeDetailsPage() {
  const router = useRouter();

  const onBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/master/me/income');
  };

  const { data: list = [], isLoading } = useQuery<Settlement[]>({
    queryKey: QK.masterIncomeDetails,
    queryFn: () => getMyIncomeDetails(),
    refetchOnMount: 'always',
  });

  return (
    <>
      <PortalNavSetter
        title="收入明细"
        showBack
        backHref="/master/me/income"
        onBack={onBack}
      />

      <div className="laoma-container">
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            收入明细
            <span className="field-hint" style={{ marginLeft: 8 }}>
              常规单验收后自动入账；退款补偿需平台审核
            </span>
          </div>
          {isLoading ? (
            <div className="field-hint" style={{ padding: '16px 0', textAlign: 'center' }}>
              加载中…
            </div>
          ) : list.length === 0 ? (
            <EmptyState text="暂无收入明细" />
          ) : (
            <div>
              {list.map((s) => {
                const st = ST_STATUS[s.status] ?? { label: s.status, color: 'var(--color-text)' };
                const isRejected = s.status === 'rejected';
                const name =
                  (s.order?.serviceSnapshot as { name?: string } | null)?.name ?? '家政服务';
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: '10px 0',
                      borderBottom: '1px solid var(--color-border, #f0f0f0)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1 }}>
                        {s.type === 'compensation' ? '退款补偿' : name}
                        <span className="field-hint" style={{ marginLeft: 6 }}>
                          {s.order?.orderNo ?? ''}
                        </span>
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: isRejected ? 'var(--color-text)' : 'var(--color-primary-text)',
                        }}
                      >
                        {isRejected ? '' : '+'}¥{Number(s.masterAmount).toFixed(2)}
                      </span>
                    </div>
                    <div className="field-hint" style={{ marginTop: 4 }}>
                      {s.type === 'compensation' ? '补偿单 · ' : ''}
                      {fmtTime(s.settledAt ?? s.createdAt)} · <span style={{ color: st.color }}>{st.label}</span>
                    </div>
                    {s.status === 'rejected' && s.note ? (
                      <div className="field-hint" style={{ marginTop: 2, color: 'var(--color-danger)' }}>
                        驳回原因：{s.note}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
