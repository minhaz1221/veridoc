import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'VeriDoc — Blockchain Document Verification',
    template: '%s | VeriDoc',
  },
  description: 'Verify document authenticity with blockchain-anchored cryptographic proof. No wallet required.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
