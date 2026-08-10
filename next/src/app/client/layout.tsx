import type { Metadata } from 'next';
import PortalShell from '../../components/PortalShell';

export const metadata: Metadata = {
  title: '老马家电 - 用户端',
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell role="customer">{children}</PortalShell>;
}
