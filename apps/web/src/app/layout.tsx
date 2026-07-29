import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VeriDoc — Blockchain Document Verification',
  description: 'Verify the authenticity of documents anchored on-chain. No wallet required.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
