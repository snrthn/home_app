'use client';

import { useRouter } from 'next/navigation';
import { PortalNavSetter } from '@/components/PortalShell';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/EmptyState';

export default function MasterIncomePage() {
  const router = useRouter();
  const toast = useToast();

  const onBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/master/me');
  };

  const onWithdraw = () => {
    toast.info('提现功能待财务系统对接后开放');
  };

  const summary = [
    { label: '可提现余额', value: '—', tone: 'var(--color-primary-text)' },
    { label: '待结算', value: '—', tone: 'var(--color-text)' },
    { label: '累计收入', value: '—', tone: 'var(--color-text)' },
  ];

  return (
    <>
      <PortalNavSetter title="收入提现" showBack backHref="/master/me" onBack={onBack} />

      <div className="laoma-container">
        {/* 账户概览 */}
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {summary.map((s) => (
              <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.tone }}>{s.value}</div>
                <div className="field-hint" style={{ marginTop: 4 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 14, width: '100%' }}
            onClick={onWithdraw}
          >
            申请提现
          </button>
          <div className="field-hint" style={{ marginTop: 8, textAlign: 'center' }}>
            账户数据待财务结算系统对接后展示
          </div>
        </div>

        {/* 提现记录 */}
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>提现记录</div>
          <EmptyState text="暂无提现记录" />
        </div>
      </div>
    </>
  );
}
