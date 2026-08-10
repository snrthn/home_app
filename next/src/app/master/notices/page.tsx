'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import NoticeList from '@/components/NoticeList';

export default function MasterNoticesPage() {
  return (
    <>
      <PortalNavSetter
        title="平台公告"
        showBack
        backHref="/master"
        menu={[{ label: '关于我们', href: '/master/about' }]}
      />
      <div className="laoma-container">
        <NoticeList scope="master" />
      </div>
    </>
  );
}
