'use client';

import { useRouter } from 'next/navigation';
import { PortalNavSetter } from '@/components/PortalShell';
import OnlineServiceCall from '@/components/OnlineServiceCall';

export default function OnlineServicePage() {
  const router = useRouter();
  const onBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/client/me');
  };

  return (
    <>
      <PortalNavSetter title="在线客服" showBack backHref="/client/me" onBack={onBack} />
      <OnlineServiceCall />
    </>
  );
}
