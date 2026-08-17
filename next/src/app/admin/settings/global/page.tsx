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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setSiteName(data.siteName ?? '');
    setPhone(data.customerServicePhone ?? '');
    setLogoUrl(data.logoUrl ?? '');
    setPrimaryColor(data.primaryColor || DEFAULT_COLOR);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await updateGlobalConfig({
        siteName: siteName || undefined,
        customerServicePhone: customerServicePhone || undefined,
        logoUrl: logoUrl || undefined,
        primaryColor: primaryColor || undefined,
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
