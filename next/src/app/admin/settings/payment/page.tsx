'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPaymentConfig,
  savePaymentConfig,
  type MerchantConfigDto,
  type PaymentProviderKey,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { Field } from '@/components/form';
import { RadioGroup } from '@/components/form';
import { useToast } from '@/components/Toast';

const PROVIDER_OPTIONS = [
  { label: '模拟支付（默认）', value: 'mock' },
  { label: '微信支付', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
];

const EMPTY: MerchantConfigDto = {
  provider: 'mock',
  enabled: false,
  appId: '',
  mchId: '',
  appSecret: '',
  apiKey: '',
  certContent: '',
};

export default function PaymentConfigPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<MerchantConfigDto>({
    queryKey: QK.paymentConfig,
    queryFn: getPaymentConfig,
  });

  const [provider, setProvider] = useState<PaymentProviderKey>('mock');
  const [enabled, setEnabled] = useState(false);
  const [appId, setAppId] = useState('');
  const [mchId, setMchId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [certContent, setCertContent] = useState('');
  const [err, setErr] = useState('');

  // 回填：后端返回脱敏配置（密钥为空），仅回填非敏感字段
  useEffect(() => {
    if (!data) return;
    setProvider(data.provider ?? 'mock');
    setEnabled(!!data.enabled);
    setAppId(data.appId ?? '');
    setMchId(data.mchId ?? '');
    setAppSecret('');
    setApiKey('');
    setCertContent('');
  }, [data]);

  // 真实通道未启用 / 选了模拟支付 时，商户字段整体禁用（灰掉），符合「先填配置、再一键接入」心智
  const isMock = provider === 'mock';
  const merchantLocked = !enabled || isMock;

  const saveMut = useMutation({
    mutationFn: () =>
      savePaymentConfig({
        provider,
        enabled,
        appId: appId || undefined,
        mchId: mchId || undefined,
        // 仅当启用真实通道且填写时才提交密钥；留空表示沿用已存值（后端加密存储）
        appSecret: !merchantLocked && appSecret ? appSecret : undefined,
        apiKey: !merchantLocked && apiKey ? apiKey : undefined,
        certContent: !merchantLocked && certContent ? certContent : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.paymentConfig });
      toast.success('支付配置已保存');
      setErr('');
    },
    onError: (e: any) =>
      setErr(e?.response?.data?.message || e?.message || '保存失败'),
  });

  return (
    <div>
      <div className="page-head">
        <h2>支付配置</h2>
      </div>
      <div className="card">
        {isLoading ? (
          <p style={{ color: 'var(--color-text-soft)' }}>加载中…</p>
        ) : (
          <>
            <p style={{ color: 'var(--color-text-soft)', marginTop: 0 }}>
              配置商户信息后，将「启用真实通道」开启即可一键接入微信/支付宝；关闭则全局走模拟支付（无需真实付款）。敏感字段加密存储，不在前端回显明文。
            </p>
            {err && <p style={{ color: '#c0392b', margin: '0 0 12px' }}>{err}</p>}

            <Field label="支付通道" hint="模拟支付默认可用；微信/支付宝需配置商户信息并启用真实通道">
              <RadioGroup
                value={provider}
                options={PROVIDER_OPTIONS}
                onChange={(v) => {
                  const p = v as PaymentProviderKey;
                  setProvider(p);
                  // 选模拟支付时无「启用真实通道」语义，自动取消，避免状态矛盾
                  if (p === 'mock') setEnabled(false);
                }}
              />
            </Field>

            <Field
              label="启用真实通道"
              hint={
                isMock
                  ? '模拟支付通道无需启用真实支付'
                  : '启用后将以真实微信/支付宝收款，请先填好下方商户信息'
              }
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={isMock}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span>
                  {isMock
                    ? '（模拟支付无需启用）'
                    : enabled
                      ? '已启用（走真实支付）'
                      : '未启用（走模拟支付）'}
                </span>
              </label>
            </Field>

            <Field
              label="AppID"
              hint={merchantLocked ? '启用真实通道后填写' : undefined}
            >
              <input
                className="input"
                value={appId}
                disabled={merchantLocked}
                placeholder="如 微信 AppID / 支付宝 AppId"
                onChange={(e) => setAppId(e.target.value)}
              />
            </Field>

            <Field
              label="商户号 (mchId)"
              hint={merchantLocked ? '启用真实通道后填写' : undefined}
            >
              <input
                className="input"
                value={mchId}
                disabled={merchantLocked}
                placeholder="微信 mch_id / 支付宝 PID"
                onChange={(e) => setMchId(e.target.value)}
              />
            </Field>

            <Field
              label="AppSecret"
              hint={merchantLocked ? '启用真实通道后填写，留空表示不修改' : '加密存储，不回显明文'}
            >
              <input
                className="input"
                type="password"
                value={appSecret}
                disabled={merchantLocked}
                placeholder={merchantLocked ? '未启用' : '填写后保存即加密存储'}
                onChange={(e) => setAppSecret(e.target.value)}
              />
            </Field>

            <Field
              label="API Key"
              hint={merchantLocked ? '启用真实通道后填写，留空表示不修改' : '加密存储，不回显明文'}
            >
              <input
                className="input"
                type="password"
                value={apiKey}
                disabled={merchantLocked}
                placeholder={merchantLocked ? '未启用' : '填写后保存即加密存储'}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </Field>

            <Field
              label="证书内容 (certContent)"
              hint={merchantLocked ? '启用真实通道后填写，留空表示不修改' : '加密存储，不回显明文'}
            >
              <textarea
                className="input"
                style={{ minHeight: 80 }}
                value={certContent}
                disabled={merchantLocked}
                placeholder={merchantLocked ? '未启用' : 'PEM 证书内容，填写后保存即加密存储'}
                onChange={(e) => setCertContent(e.target.value)}
              />
            </Field>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? '保存中…' : '保存配置'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
