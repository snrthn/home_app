'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import AboutContent from '@/components/AboutContent';

export default function ClientAbout() {
  return (
    <>
      <PortalNavSetter title="关于我们" showBack backHref="/client/me" />
      <div className="laoma-container">
        <AboutContent role="customer" />
      </div>
    </>
  );
}
