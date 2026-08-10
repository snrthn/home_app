'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import NoticeList from '@/components/NoticeList';

export default function ClientNoticesPage() {
  return (
    <>
      <PortalNavSetter
        title="平台公告"
        showBack
        backHref="/client"
        menu={[{ label: '关于我们', href: '/client/about' }]}
      />
      <div className="laoma-container">
        <NoticeList scope="customer" />
      </div>
    </>
  );
}
