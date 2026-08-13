'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 叠层弹窗原语：解决「真二级弹窗」场景下两个历史坑。
 *
 * 1. Esc 只关最上层：全局仅注册一个 keydown 监听（按引用计数启停），
 *    触发时只调用栈顶弹窗的 onClose，避免两层弹窗被一次 Esc 同时关掉。
 * 2. 遮罩 z-index 随层级递增（1000 + layer*10），保证叠层时上层永远盖住下层。
 *
 * closeOnOverlay 默认 false，沿用项目铁律：弹窗不点遮罩关闭（只走 ×/取消/确认）。
 */

// 模块级弹窗栈：记录当前打开的弹窗层级，栈顶 = 最上层。
interface StackEntry {
  id: number;
  onClose: () => void;
}
const stack: StackEntry[] = [];
let layerSeq = 0;

function pushModal(onClose: () => void): number {
  const id = ++layerSeq;
  stack.push({ id, onClose });
  return id;
}
function popModal(id: number) {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx >= 0) stack.splice(idx, 1);
}
function topModal(): StackEntry | undefined {
  return stack[stack.length - 1];
}

// 全局 Esc 监听按引用计数启停，确保任意时刻最多一个监听器。
let escListenerCount = 0;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
function ensureEscListener() {
  if (escListenerCount === 0) {
    escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const top = topModal();
        if (top) top.onClose();
      }
    };
    document.addEventListener('keydown', escHandler);
  }
  escListenerCount++;
}
function releaseEscListener() {
  escListenerCount = Math.max(0, escListenerCount - 1);
  if (escListenerCount === 0 && escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
}

type ModalWidth = 'default' | 'md' | 'lg';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: ModalWidth;
  /** 默认 false：弹窗不点遮罩关闭（项目铁律） */
  closeOnOverlay?: boolean;
  /** 是否显示右上角 × 按钮，默认 true */
  showClose?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'default',
  closeOnOverlay = false,
  showClose = true,
}: ModalProps) {
  const idRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [layer, setLayer] = useState(0);

  // 打开时入栈并启用全局 Esc；关闭/卸载时出栈并释放 Esc。
  useEffect(() => {
    if (!open) return;
    const id = pushModal(() => onCloseRef.current());
    idRef.current = id;
    setLayer(stack.findIndex((e) => e.id === id) + 1);
    ensureEscListener();
    return () => {
      popModal(id);
      releaseEscListener();
      idRef.current = null;
      setLayer(0);
    };
  }, [open]);

  if (!open) return null;

  const widthClass =
    width === 'lg' ? 'modal-lg' : width === 'md' ? 'modal-md' : '';
  const zIndex = 1000 + (layer || 1) * 10;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex }}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={`modal-panel ${widthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <span>{title}</span>
            {showClose && (
              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                aria-label="关闭"
              >
                ×
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}
