'use client';
import { useEffect, useState } from 'react';
import { decodeBundle } from '@veridoc/core';
import type { CredentialBundle } from '@veridoc/core';
import { VerifyForm } from '../../../../components/VerifyForm';

type Props = { batchId: string; certId: string };

export function VerifyPageClient({ batchId, certId }: Props) {
  const [bundle, setBundle] = useState<CredentialBundle | null>(null);
  const [salt, setSalt] = useState<string | null>(null);

  // Read salt from URL fragment (#s=0x...)
  useEffect(() => {
    const hash = window.location.hash;
    const match = /[#&]s=([^&]+)/.exec(hash);
    if (match?.[1]) {
      setSalt(decodeURIComponent(match[1]));
    }
  }, []);

  return (
    <main className="page-shell">
      <header className="site-header">
        <span className="site-name">VeriDoc</span>
        <nav>
          <a href="/">Verify</a>
          <a href="/demo">Demo</a>
          <a href="/issuer">Issuer</a>
        </nav>
      </header>

      <div className="page-content">
        <h1>Verify Certificate</h1>
        <dl className="cert-meta">
          <dt>Certificate ID</dt>
          <dd><code>{certId}</code></dd>
          <dt>Batch ID</dt>
          <dd><code>{batchId}</code></dd>
        </dl>
        <p className="page-lead">
          Upload the original certificate PDF to verify it. The file is hashed
          locally — it never leaves your browser.
          {salt && ' The credential bundle has been loaded from the QR code.'}
        </p>
        <VerifyForm initialBundle={bundle ?? undefined} />
        {!salt && (
          <p className="page-hint">
            You can also drag and drop the bundle JSON alongside the PDF.
          </p>
        )}
      </div>
    </main>
  );
}
