'use client';

import { useState, useEffect } from 'react';
import { Textarea } from './form/Textarea';
import { useEscClose } from '@/lib/useEscClose';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  requireReason = false,
  reasonLabel = '拒绝理由',
  reasonPlaceholder = '请输入理由',
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');

  // 关闭时清空理由，避免下次打开残留
  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  // Esc 关闭
  useEscClose(onCancel);

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{title}</span>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          {message && <p className="confirm-message">{message}</p>}
          {requireReason && (
            <div className="field">
              <label className="field-label">{reasonLabel}</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                rows={3}
                disabled={loading}
              />
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onConfirm(requireReason ? reason : undefined)}
            disabled={loading || confirmDisabled || (requireReason && !reason.trim())}
          >
            {loading ? '处理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
