'use client';

import { useState } from 'react';
import { uploadAvatar, resolveAsset } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { validateUploadFile } from '@laoma/shared';

// 头像字段：支持「本地上传」（调后端 /upload，存为 /uploads 相对 URL）+「填写 URL」兜底，
// 统一预览与样式，避免各页面手搓导致走形。
export function AvatarField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const preview = resolveAsset(value);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 前端抢校验（规则来自共享 upload-rules，与后端一致），不合规直接拦截，省一次请求
    const v = validateUploadFile({ sizeBytes: file.size, mime: file.type });
    if (!v.ok) {
      toast.error(v.error);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      if (url) onChange(url);
    } catch (e2: any) {
      toast.error(e2?.response?.data?.message || '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="avatar-field">
      <div className="avatar-preview">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="头像预览" />
        ) : (
          <div className="avatar-empty">无</div>
        )}
      </div>
      <div className="avatar-actions">
        <label className="btn-secondary upload-btn">
          {uploading ? '上传中…' : '上传图片'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={onFile}
            disabled={uploading}
          />
        </label>
        <input
          className="input"
          style={{ flex: 1, minWidth: 0 }}
          placeholder="或填写图片 URL"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
