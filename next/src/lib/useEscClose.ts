import { useEffect, useRef } from 'react';

/**
 * 弹窗 Esc 关闭：按下 Escape 时调用 onClose。
 * 用 ref 持有最新 handler，组件生命周期内只绑定一次监听，避免重复 add/remove。
 */
export function useEscClose(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
