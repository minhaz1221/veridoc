import type { Metadata } from 'next';
import { VerifyPageClient } from './VerifyPageClient';

type Props = {
  params: Promise<{ batchId: string; certId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certId } = await params;
  return {
    title: `VeriDoc — Verify ${certId}`,
    description: 'Verify this document against its blockchain-anchored record.',
  };
}

export default async function VerifyDeepLinkPage({ params }: Props) {
  const { batchId, certId } = await params;
  return <VerifyPageClient batchId={batchId} certId={certId} />;
}
