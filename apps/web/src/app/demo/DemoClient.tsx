'use client';
import { useState } from 'react';

type HashState =
  | { stage: 'idle' }
  | { stage: 'loading' }
  | { stage: 'done'; original: string; tampered: string };

function diffHex(a: string, b: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Both are 0x + 64 hex chars; compare char by char
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ca = a[i] ?? '';
    const cb = b[i] ?? '';
    if (ca !== cb) {
      parts.push(
        <mark key={i} className="diff-mark" title={`Position ${i}: original='${ca}' tampered='${cb}'`}>
          {cb}
        </mark>,
      );
    } else {
      parts.push(<span key={i}>{cb}</span>);
    }
  }
  return parts;
}

async function hashArrayBuffer(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return '0x' + Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function DemoClient() {
  const [state, setState] = useState<HashState>({ stage: 'idle' });
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [tamperedFile, setTamperedFile] = useState<File | null>(null);

  async function runDemo() {
    if (!originalFile || !tamperedFile) return;
    setState({ stage: 'loading' });

    const [origBuf, tampBuf] = await Promise.all([
      originalFile.arrayBuffer(),
      tamperedFile.arrayBuffer(),
    ]);

    const [original, tampered] = await Promise.all([
      hashArrayBuffer(origBuf),
      hashArrayBuffer(tampBuf),
    ]);

    setState({ stage: 'done', original, tampered });
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <span className="site-name">VeriDoc</span>
        <nav>
          <a href="/">Verify</a>
          <a href="/issuer">Issuer</a>
        </nav>
      </header>

      <div className="page-content">
        <h1>How It Works</h1>
        <p className="page-lead">
          VeriDoc detects document tampering by comparing SHA-256 hashes. A single changed
          character in a PDF — one digit in a grade, one letter in a name — produces a
          completely different hash. Load two documents below to see this live.
        </p>

        <section className="demo-section">
          <h2>The core idea</h2>
          <ol className="demo-steps">
            <li>
              <strong>Issuer hashes the document:</strong> At graduation time, the issuer
              computes the SHA-256 of each certificate PDF (plus a random salt), builds a
              Merkle tree of all certificates, and anchors the root on Ethereum in a single
              transaction.
            </li>
            <li>
              <strong>Holder receives a credential bundle:</strong> The bundle contains the
              document hash, the Merkle proof, and the salt. It travels with the document —
              embedded in a QR code, emailed, or stored alongside the PDF.
            </li>
            <li>
              <strong>Verifier hashes the file locally:</strong> The uploaded file is hashed
              in the browser. No bytes leave your machine. The hash is checked against the
              anchored Merkle root using the proof from the bundle.
            </li>
            <li>
              <strong>The chain decides:</strong> If the proof verifies, the document is
              Valid. If the hash changed, it is Tampered. If revoked, it shows the reason
              and date.
            </li>
          </ol>
        </section>

        <section className="demo-section">
          <h2>Live hash comparison</h2>
          <p>
            Load two PDFs — an original and a modified copy — to see how even a single
            changed byte produces an entirely different hash.
          </p>
          <div className="demo-inputs">
            <label className="file-label">
              <span>Original PDF</span>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setOriginalFile(f); }}
                aria-label="Select original PDF"
              />
              {originalFile && <span className="file-chosen">{originalFile.name}</span>}
            </label>
            <label className="file-label">
              <span>Modified PDF</span>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setTamperedFile(f); }}
                aria-label="Select modified PDF"
              />
              {tamperedFile && <span className="file-chosen">{tamperedFile.name}</span>}
            </label>
          </div>
          <button
            onClick={runDemo}
            disabled={!originalFile || !tamperedFile || state.stage === 'loading'}
            className="verify-button"
          >
            {state.stage === 'loading' ? 'Hashing...' : 'Compare Hashes'}
          </button>

          {state.stage === 'done' && (
            <div className="hash-comparison" role="region" aria-label="Hash comparison">
              <div className="hash-row">
                <span className="hash-label">Original</span>
                <code className="hash-value">{state.original}</code>
              </div>
              <div className="hash-row">
                <span className="hash-label">Modified</span>
                <code className="hash-value">{diffHex(state.original, state.tampered)}</code>
              </div>
              {state.original !== state.tampered ? (
                <p className="hash-verdict tampered">
                  The hashes differ — even one changed byte produces a completely different fingerprint.
                  This document would return <strong>Tampered</strong> during verification.
                </p>
              ) : (
                <p className="hash-verdict valid">
                  The hashes match — these files are byte-for-byte identical.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="demo-section">
          <h2>Why the blockchain?</h2>
          <p>
            A database controlled by the issuer could silently modify or delete records.
            The issuer is inside the threat model. A blockchain is append-only: a Merkle
            root, once anchored in a transaction, cannot be changed without the block
            timestamp betraying it. Verification works even if the issuer&apos;s servers go
            offline — any Ethereum node serves the truth.
          </p>
        </section>
      </div>
    </main>
  );
}
