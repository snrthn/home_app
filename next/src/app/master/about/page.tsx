'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import AboutContent from '@/components/AboutContent';

export default function MasterAbout() {
  return (
    <>
      <PortalNavSetter title="关于我们" showBack backHref="/master/me" />
      <div className="laoma-container">
        <AboutContent role="master" />
      </div>
    </>
  );
}
