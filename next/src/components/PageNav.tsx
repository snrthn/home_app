'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export interface PageNavMenuItem {
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  /** 在该项之前渲染一条分隔线 */
  dividerBefore?: boolean;
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

// 移动端统一导航栏：左侧返回、居中标题、右侧下拉菜单（溢出菜单）。
// 各页（首页/公告/我的）均使用本组件，统一承担返回、标题与下拉菜单职责。
export default function PageNav({
  title,
  showBack = false,
  backHref,
  onBack,
  menu,
}: {
  title: string;
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
  menu?: PageNavMenuItem[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocPointer = (e: MouseEvent) => {
      if (rightRef.current && !rightRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const backNode = showBack ? (
    backHref ? (
      <Link href={backHref} className="page-nav-back" aria-label="返回">
        <ChevronLeft />
      </Link>
    ) : (
      <button type="button" className="page-nav-back" onClick={onBack} aria-label="返回">
        <ChevronLeft />
      </button>
    )
  ) : null;

  return (
    <div className="page-nav">
      <div className="page-nav-inner">
        <div className="page-nav-left">{backNode}</div>
        <div className="page-nav-title">{title}</div>
        <div className="page-nav-right" ref={rightRef}>
          {menu && menu.length > 0 && (
            <button
              type="button"
              className="page-nav-more"
              aria-label="菜单"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreIcon />
            </button>
          )}
          {menuOpen && menu && (
            <div className="page-nav-menu" role="menu">
              {menu.map((item, i) => (
                <div key={i}>
                  {item.dividerBefore && <div className="page-nav-menu-divider" />}
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={`page-nav-menu-item${item.danger ? ' danger' : ''}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={`page-nav-menu-item${item.danger ? ' danger' : ''}`}
                      onClick={() => {
                        setMenuOpen(false);
                        item.onClick?.();
                      }}
                    >
                      {item.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
