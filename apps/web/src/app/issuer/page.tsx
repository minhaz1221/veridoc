import type { Metadata } from 'next';
import { IssuerDashboard } from './IssuerDashboard';

export const metadata: Metadata = {
  title: 'VeriDoc — Issuer Dashboard',
  description: 'Anchor batch Merkle roots and revoke credentials.',
};

export default function IssuerPage() {
  return <IssuerDashboard />;
}
