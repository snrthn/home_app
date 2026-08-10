'use client';

import { useState } from 'react';
import { PasswordForm } from './PasswordForm';
import { FormCard } from './FormCard';

// 个人中心「账号安全」入口。
// - 非受控（默认）：自带一个「修改/设置登录密码」入口按钮，点击弹出 Modal。
// - 受控（传入 open/onClose）：不渲染入口按钮，仅作为 Modal 由外部（如下拉菜单）控制开关。
export function PasswordDialog({
  hasPassword,
  onSuccess,
  open,
  onClose,
}: {
  hasPassword: boolean;
  onSuccess?: () => void;
  open?: boolean;
  onClose?: () => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : innerOpen;

  const close = () => {
    if (!isControlled) setInnerOpen(false);
    onClose?.();
  };

  return (
    <>
      {!isControlled && (
        <FormCard title="账号安全">
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%' }}
            onClick={() => setInnerOpen(true)}
          >
            {hasPassword ? '修改登录密码' : '设置登录密码'}
          </button>
        </FormCard>
      )}

      {isOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>{hasPassword ? '修改登录密码' : '设置登录密码'}</span>
              <button
                type="button"
                className="modal-close"
                onClick={close}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <PasswordForm
                hasPassword={hasPassword}
                onSuccess={() => {
                  close();
                  onSuccess?.();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
