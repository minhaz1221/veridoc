import type { Metadata } from 'next';
import { VerifyForm } from '../components/VerifyForm';

export const metadata: Metadata = {
  title: 'VeriDoc — Verify a Document',
  description: 'Verify that a document is authentic using blockchain-anchored proof. No wallet required.',
};

export default function VerifyPage() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <span className="site-name">VeriDoc</span>
        <nav>
          <a href="/demo">Demo</a>
          <a href="/issuer">Issuer</a>
        </nav>
      </header>

      <div className="page-content">
        <h1>Document Verification</h1>
        <p className="page-lead">
          Upload the original document and its credential bundle. The file is hashed
          locally — it never leaves your browser. The hash is checked against the
          record anchored on Ethereum.
        </p>
        <VerifyForm />
      </div>
    </main>
  );
}
