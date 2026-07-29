import type { Metadata } from 'next';
import { DemoClient } from './DemoClient';

export const metadata: Metadata = {
  title: 'VeriDoc — Demo',
  description: 'See how VeriDoc detects a single-byte change in a document.',
};

export default function DemoPage() {
  return <DemoClient />;
}
