// 上传文件校验规则（前后端共用，单一事实来源，避免两端限制漂移）
// 前后端都引用本文件：后端在 UploadService 落盘前校验，前端在选文件时校验，
// 任一侧改限制只需改这里。

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export const UPLOAD_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export interface UploadFileMeta {
  sizeBytes: number;
  mime: string;
}

export type UploadValidation =
  | { ok: true }
  | { ok: false; error: string };

export function validateUploadFile(
  file: UploadFileMeta,
  opts?: { maxBytes?: number; allowedMime?: readonly string[] },
): UploadValidation {
  const max = opts?.maxBytes ?? UPLOAD_MAX_BYTES;
  const allowed = opts?.allowedMime ?? UPLOAD_ALLOWED_MIME;
  if (!file.mime || !(allowed as readonly string[]).includes(file.mime)) {
    return { ok: false, error: '仅支持 JPG / PNG / GIF / WEBP 图片' };
  }
  if (file.sizeBytes > max) {
    return { ok: false, error: '图片大小不能超过 5MB' };
  }
  return { ok: true };
}
