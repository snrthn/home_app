'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PortalNavSetter } from '@/components/PortalShell';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/EmptyState';
import { Modal } from '@/components/Modal';
import { TextInput } from '@/components/form/TextInput';
import { RadioGroup } from '@/components/form/RadioGroup';
import {
  getMyIncomeSummary,
  getMyWithdrawals,
  createWithdrawal,
  type IncomeSummary,
  type Withdrawal,
} from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const CHANNEL_LABEL: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行卡',
};

const WD_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'var(--color-warning, #e6a23c)' },
  paid: { label: '已打款', color: 'var(--color-success, #2da961)' },
  rejected: { label: '已驳回', color: 'var(--color-danger, #e54545)' },
};

function fmtTime(t?: string | null) {
  return formatDateTime(t);
}

export default function MasterIncomePage() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const onBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/master/me');
  };

  const { data: summary } = useQuery<IncomeSummary>({
    queryKey: QK.masterIncomeSummary,
    queryFn: () => getMyIncomeSummary(),
    refetchOnMount: 'always',
  });
  const { data: withdrawals = [] } = useQuery<Withdrawal[]>({
    queryKey: QK.masterWithdrawals,
    queryFn: () => getMyWithdrawals(),
    refetchOnMount: 'always',
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: QK.masterIncomeSummary });
    qc.invalidateQueries({ queryKey: QK.masterWithdrawals });
  };

  // ---- 申请提现弹窗 ----
  const [wdOpen, setWdOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('wechat');
  const [account, setAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const available = Number(summary?.available ?? 0);

  const openWd = () => {
    if (available <= 0) {
      toast.info('当前无可提现余额');
      return;
    }
    setAmount('');
    setChannel('wechat');
    setAccount('');
    setWdOpen(true);
  };

  const submitWithdrawal = async () => {
    const amt = Math.round(Number(amount) * 100) / 100;
    if (!amt || amt <= 0) {
      toast.error('请填写正确的提现金额');
      return;
    }
    if (amt > available) {
      toast.error(`超出可提现余额（¥${available.toFixed(2)}）`);
      return;
    }
    if (!account.trim()) {
      toast.error('请填写收款账号');
      return;
    }
    setSubmitting(true);
    try {
      await createWithdrawal({
        amount: amt,
        channel: channel as 'wechat' | 'alipay' | 'bank',
        account: account.trim(),
      });
      toast.success('提现申请已提交，待平台审核');
      setWdOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const overview = [
    { label: '本月入账', value: summary?.monthCredited ?? 0 },
    { label: '累计入账', value: summary?.totalCredited ?? 0 },
    { label: '提现中', value: summary?.withdrawing ?? 0 },
    { label: '待审核补偿', value: summary?.pendingCompensation ?? 0 },
  ];

  return (
    <>
      <PortalNavSetter title="收入提现" showBack backHref="/master/me" onBack={onBack} />

      <div className="laoma-container">
        {/* 账户概览 */}
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="field-hint">可提现余额（元）</div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: 'var(--color-primary-text)',
                marginTop: 4,
              }}
            >
              {(summary ? available.toFixed(2) : '—')}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--color-border, #eee)',
            }}
          >
            {overview.map((s) => (
              <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {summary ? Number(s.value).toFixed(2) : '—'}
                </div>
                <div className="field-hint" style={{ marginTop: 2 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={openWd}>
              申请提现
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => router.push('/master/me/income/details')}
            >
              收入明细
            </button>
          </div>
        </div>

        {/* 提现记录 */}
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>提现记录</div>
          {withdrawals.length === 0 ? (
            <EmptyState text="暂无提现记录" />
          ) : (
            <div>
              {withdrawals.map((w) => {
                const st = WD_STATUS[w.status] ?? { label: w.status, color: 'var(--color-text)' };
                return (
                  <div
                    key={w.id}
                    style={{
                      padding: '10px 0',
                      borderBottom: '1px solid var(--color-border, #f0f0f0)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, flex: 1 }}>
                        -¥{Number(w.amount).toFixed(2)}
                      </span>
                      <span style={{ color: st.color, fontSize: 13 }}>{st.label}</span>
                    </div>
                    <div className="field-hint" style={{ marginTop: 4 }}>
                      {CHANNEL_LABEL[w.channel] ?? w.channel} · {fmtTime(w.createdAt)}
                      {w.status === 'paid' && w.paidAt ? ` · 打款 ${fmtTime(w.paidAt)}` : ''}
                    </div>
                    {w.status === 'rejected' && w.reviewNote ? (
                      <div
                        className="field-hint"
                        style={{ marginTop: 2, color: 'var(--color-danger, #e54545)' }}
                      >
                        驳回原因：{w.reviewNote}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 申请提现弹窗 */}
      <Modal open={wdOpen} onClose={() => setWdOpen(false)} title="申请提现">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>
              提现金额（可提现 ¥{available.toFixed(2)}）
            </div>
            <TextInput
              type="number"
              inputMode="decimal"
              placeholder="请输入提现金额"
              value={amount}
              max={available}
              step="0.01"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>
              收款渠道
            </div>
            <RadioGroup
              value={channel}
              onChange={setChannel}
              options={[
                { label: '微信', value: 'wechat' },
                { label: '支付宝', value: 'alipay' },
                { label: '银行卡', value: 'bank' },
              ]}
            />
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>
              收款账号
            </div>
            <TextInput
              placeholder={channel === 'bank' ? '银行卡号' : channel === 'wechat' ? '微信号' : '支付宝账号'}
              value={account}
              maxLength={100}
              onChange={(e) => setAccount(e.target.value)}
            />
          </div>
          <div className="field-hint">
            提交后金额立即冻结，平台审核通过并打款后到账；驳回将解冻退回余额。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setWdOpen(false)}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={submitting}
            onClick={submitWithdrawal}
          >
            {submitting ? '提交中…' : '提交申请'}
          </button>
        </div>
      </Modal>
    </>
  );
}
