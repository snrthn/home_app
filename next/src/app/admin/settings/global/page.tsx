'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGlobalConfig, updateGlobalConfig, uploadFile, resolveAsset, getApiErrorMsg } from '@/lib/api';
import { QK } from '@/lib/query-keys';
import { Field } from '@/components/form';
import { useToast } from '@/components/Toast';
import { applyThemeColor } from '@/lib/theme';

const DEFAULT_COLOR = '#3e8fb0';

export default function GlobalConfigPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QK.globalConfig,
    queryFn: getGlobalConfig,
  });

  const [siteName, setSiteName] = useState('');
  const [customerServicePhone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_COLOR);
  const [smsMode, setSmsMode] = useState<'mock' | 'real'>('mock');
  const [smsAccessKeyId, setSmsAccessKeyId] = useState('');
  const [smsAccessKeySecret, setSmsAccessKeySecret] = useState('');
  const [smsSignName, setSmsSignName] = useState('');
  const [smsTemplateCode, setSmsTemplateCode] = useState('');
  const [smsSecretSet, setSmsSecretSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setSiteName(data.siteName ?? '');
    setPhone(data.customerServicePhone ?? '');
    setLogoUrl(data.logoUrl ?? '');
    setPrimaryColor(data.primaryColor || DEFAULT_COLOR);
    setSmsMode((data.smsMode as 'mock' | 'real') ?? 'mock');
    setSmsAccessKeyId(data.smsAccessKeyId ?? '');
    // 接口不再返回 secret 明文（统一掩码），输入框保持空，仅作「填写=更新」用途
    setSmsAccessKeySecret('');
    setSmsSignName(data.smsSignName ?? '');
    setSmsTemplateCode(data.smsTemplateCode ?? '');
    setSmsSecretSet(!!data.smsSecretSet);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await updateGlobalConfig({
        siteName: siteName || undefined,
        customerServicePhone: customerServicePhone || undefined,
        logoUrl: logoUrl || undefined,
        primaryColor: primaryColor || undefined,
        smsMode,
        smsAccessKeyId: smsAccessKeyId || undefined,
        smsAccessKeySecret: smsAccessKeySecret || undefined,
        smsSignName: smsSignName || undefined,
        smsTemplateCode: smsTemplateCode || undefined,
      });
      qc.invalidateQueries({ queryKey: QK.globalConfig });
      applyThemeColor(primaryColor);
      toast.success('全局配置已保存');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 上传 Logo 图片：复用通用上传链路，返回相对 URL 后写入 logoUrl
  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const url = await uploadFile(file);
        if (url) {
          setLogoUrl(url);
          toast.success('Logo 已上传');
        }
      } catch (err) {
        toast.error(getApiErrorMsg(err));
      } finally {
        setUploading(false);
      }
    }
    // 允许再次选择同一文件
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  return (
    <div>
      <div className="page-head">
        <h2>全局配置</h2>
      </div>
      <div className="card">
        {isLoading ? (
          <p style={{ color: 'var(--color-text-soft)' }}>加载中…</p>
        ) : (
          <>
            <p style={{ color: 'var(--color-text-soft)', marginTop: 0 }}>
              聚合平台基础信息与视觉主题，修改后全端即时生效（系统名称同步用户端/师傅端/运营端，主题色立即应用，用户端「在线客服」读取客服电话）。
            </p>

            <Field label="系统名称">
              <input
                className="input"
                value={siteName}
                maxLength={60}
                placeholder="老马家电"
                onChange={(e) => setSiteName(e.target.value)}
              />
            </Field>

            <Field label="客服电话" hint="用户端「在线客服」将直接拨打此号码">
              <input
                className="input"
                value={customerServicePhone}
                placeholder="如 400-000-0000"
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>

            <Field label="站点 Logo" hint="选填：上传图片或填写图片在线地址（URL）。留空则不展示 Logo。">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* 预览（左侧）：有图展示图片，无图占位 */}
                <div
                  className="logo-preview"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 10,
                    border: '1px dashed #cfd8dd',
                    background: '#f7fafb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveAsset(logoUrl)}
                      alt="站点 Logo 预览"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: 11, color: '#9aa7ae' }}>无 Logo</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? '上传中…' : '上传图片'}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={onLogoFile}
                />
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 200 }}
                  value={logoUrl}
                  placeholder="https://... 或上传后自动填充"
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
                {logoUrl && (
                  <button
                    type="button"
                    className="btn-link btn-link-danger"
                    onClick={() => setLogoUrl('')}
                  >
                    移除
                  </button>
                )}
              </div>
            </Field>

            <Field label="主题色" hint="保存后全端主色立即更新">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{
                    width: 48,
                    height: 36,
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                />
                <input
                  className="input"
                  style={{ maxWidth: 160 }}
                  value={primaryColor}
                  placeholder={DEFAULT_COLOR}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </Field>

            <Field
              label="短信验证码模式"
              hint="mock=开发/演示（验证码直接以 Toast 显示在页面，便于本地联调）；real=真实调用阿里云短信网关下发到手机。所有环境均可切换，生产环境请谨慎。"
            >
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="smsMode"
                    checked={smsMode === 'mock'}
                    onChange={() => setSmsMode('mock')}
                  />
                  mock（演示）
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="smsMode"
                    checked={smsMode === 'real'}
                    onChange={() => setSmsMode('real')}
                  />
                  real（真实短信）
                </label>
              </div>
            </Field>

            {smsMode === 'real' && (
              <>
                <Field label="阿里云 AccessKeyId">
                  <input
                    className="input"
                    value={smsAccessKeyId}
                    placeholder="如 LTAI5t..."
                    onChange={(e) => setSmsAccessKeyId(e.target.value)}
                  />
                </Field>
                <Field
                  label="阿里云 AccessKeySecret"
                  hint={
                    smsSecretSet
                      ? '敏感凭证已加密存储；留空表示保留现有配置，仅填写时才更新'
                      : '敏感凭证，建议仅在真实环境填写并妥善保管；提交后将以加密形式存储'
                  }
                >
                  <input
                    className="input"
                    type="password"
                    value={smsAccessKeySecret}
                    placeholder={smsSecretSet ? '已配置（留空则不修改）' : 'AccessKey Secret'}
                    onChange={(e) => setSmsAccessKeySecret(e.target.value)}
                  />
                </Field>
                <Field label="短信签名 SignName">
                  <input
                    className="input"
                    value={smsSignName}
                    placeholder="如 老马家电"
                    onChange={(e) => setSmsSignName(e.target.value)}
                  />
                </Field>
                <Field label="模板 Code TemplateCode" hint="短信模板内需含 ${code} 变量，用于注入验证码">
                  <input
                    className="input"
                    value={smsTemplateCode}
                    placeholder="如 SMS_123456789"
                    onChange={(e) => setSmsTemplateCode(e.target.value)}
                  />
                </Field>
              </>
            )}

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={save}
                disabled={saving}
              >
                {saving ? '保存中…' : '保存配置'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
