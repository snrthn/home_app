'use client';

import { useEscClose } from '@/lib/useEscClose';

/**
 * 详情弹窗（只读）：与 ConfirmModal / EditModal 同风格，
 * 用于用户、师傅等列表的「查看详情」场景。
 *
 * 用法：
 *   <DetailModal open={!!detail} title="用户详情" onClose={() => setDetail(null)}>
 *     <DetailRow label="手机号" value={detail.phone} />
 *     <DetailRow label="昵称">{detail.nickname}</DetailRow>
 *   </DetailModal>
 */
export default function DetailModal({
  open,
  title,
  onClose,
  children,
  size = 'md',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEscClose(onClose);
  if (!open) return null;

  const sizeClass =
    size === 'lg' ? 'modal-lg' : size === 'sm' ? 'modal-sm' : 'modal-md';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`modal-panel ${sizeClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 详情行：label + value 的两列布局，与后台表单风格对齐。
 */
export function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="field">
      <div className="field-label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--color-text-primary)', fontSize: 14, lineHeight: 1.6 }}>
        {children ?? value ?? <span style={{ color: 'var(--color-text-soft)' }}>—</span>}
      </div>
    </div>
  );
}
