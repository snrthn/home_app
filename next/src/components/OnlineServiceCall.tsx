'use client';

import { useEffect, useState } from 'react';
import { getGlobalConfig } from '@/lib/api';

// 内联电话图标（跨端一致，不用 emoji）
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export default function OnlineServiceCall() {
  const [phone, setPhone] = useState('');

  // 客服电话来自管理端全局配置（customerServicePhone）；未配置则回退占位号
  useEffect(() => {
    getGlobalConfig()
      .then((cfg: any) => setPhone(cfg?.customerServicePhone || ''))
      .catch(() => {});
  }, []);

  const display = phone || '400-000-0000';
  // tel: 仅保留数字，避免拨号时带上分隔符
  const telHref = `tel:${display.replace(/[^0-9]/g, '')}`;

  return (
    <div className="laoma-container">
      <div className="card" style={{ marginTop: 12, textAlign: 'center', padding: '32px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>在线客服</div>
        <div className="field-hint" style={{ marginTop: 0 }}>
          如需帮助，请直接拨打客服热线，我们将尽快为您服务
        </div>
        <a
          href={telHref}
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 18,
            textDecoration: 'none',
            fontSize: 17,
            padding: '12px 26px',
          }}
        >
          <PhoneIcon />
          拨打 {display}
        </a>
        <div className="field-hint" style={{ marginTop: 16 }}>
          工作时间：周一至周日 9:00 – 21:00
        </div>
      </div>
    </div>
  );
}
