import type { Metadata } from 'next';
import PortalShell from '../../components/PortalShell';

export const metadata: Metadata = {
  title: '老马家电 - 师傅端',
};

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell role="master">{children}</PortalShell>;
}
