'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

/**
 * Toast 类型统一枚举（单一真相源）。
 * 所有业务代码统一引用此枚举，禁止在各自文件里写裸字符串类型。
 * - 新增类型：在下方追加一项 + globals.css 补一条 `.toast-<值>` 样式即可。
 * - 业务调用两种方式任选：
 *     toast.success('保存成功')              // 便捷方法
 *     toast.show(ToastType.Success, '保存成功')  // 按枚举派发（适合按类型集中处理）
 */
export const ToastType = {
  Success: 'success',
  Error: 'error',
  Info: 'info',
  Warning: 'warning',
} as const;
export type ToastType = (typeof ToastType)[keyof typeof ToastType];

interface ToastItem {
  id: number;
  type: ToastType;
  text: string;
}

export interface ToastApi {
  /** 通用入口：按枚举值派发，便于统一集中处理 */
  show: (type: ToastType, text: string) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
  warning: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_DURATION = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, text: string) => {
      const id = ++idRef.current;
      setItems((list) => [...list, { id, type, text }]);
      setTimeout(() => remove(id), TOAST_DURATION);
    },
    [remove],
  );

  const api: ToastApi = {
    show,
    success: (text) => show(ToastType.Success, text),
    error: (text) => show(ToastType.Error, text),
    info: (text) => show(ToastType.Info, text),
    warning: (text) => show(ToastType.Warning, text),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container">
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            onClick={() => remove(t.id)}
            role="alert"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  // 兜底：若在未挂载 Provider 的边界调用，静默忽略，避免崩溃
  if (!ctx) {
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
    };
  }
  return ctx;
}
