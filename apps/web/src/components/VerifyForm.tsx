'use client';
import { useState, useRef } from 'react';
import { decodeBundle } from '@veridoc/core';
import type { CredentialBundle } from '@veridoc/core';
import { verifyDocument } from '../lib/verify';
import type { VerifyResult } from '../lib/contract';
import { VerdictBlock } from './VerdictBlock';

type State =
  | { stage: 'idle' }
  | { stage: 'loading'; message: string }
  | { stage: 'done'; result: VerifyResult; fileHash: string; bundle: CredentialBundle }
  | { stage: 'error'; message: string };

type Props = {
  initialBundle?: CredentialBundle;
};

export function VerifyForm({ initialBundle }: Props) {
  const [state, setState] = useState<State>({ stage: 'idle' });
  const [file, setFile] = useState<File | null>(null);
  const [bundle, setBundle] = useState<CredentialBundle | null>(initialBundle ?? null);
  const [bundleText, setBundleText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const bundleRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  function handleFileChange(f: File) {
    setFile(f);
    setState({ stage: 'idle' });
  }

  function handleBundleFile(f: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setBundleText(text);
      try {
        setBundle(decodeBundle(text));
        setState({ stage: 'idle' });
      } catch (err) {
        setState({ stage: 'error', message: `Invalid bundle: ${String(err)}` });
      }
    };
    reader.readAsText(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const pdf = files.find((f) => f.name.endsWith('.pdf'));
    const json = files.find((f) => f.name.endsWith('.json'));
    if (pdf) handleFileChange(pdf);
    if (json) handleBundleFile(json);
  }

  async function handleVerify() {
    if (!file || !bundle) return;
    setState({ stage: 'loading', message: 'Hashing file locally...' });
    try {
      setState({ stage: 'loading', message: 'Querying blockchain...' });
      const { result, fileHash } = await verifyDocument(file, bundle);
      setState({ stage: 'done', result, fileHash, bundle });
    } catch (err) {
      setState({ stage: 'error', message: `Verification failed: ${String(err)}` });
    }
  }

  const canVerify = file !== null && bundle !== null;

  return (
    <div className="verify-form">
      {/* Dropzone */}
      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="dropzone"
        role="region"
        aria-label="Document drop zone"
      >
        <p className="dropzone-label">
          Drop your certificate PDF and bundle JSON here, or select them below.
        </p>
        <p className="dropzone-privacy">
          Your file is hashed locally in the browser. It is never uploaded anywhere.
        </p>
        <div className="dropzone-inputs">
          <label className="file-label">
            <span>Certificate PDF</span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              aria-label="Select certificate PDF"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileChange(f);
              }}
            />
            {file && <span className="file-chosen">{file.name}</span>}
          </label>
          <label className="file-label">
            <span>Bundle JSON</span>
            <input
              ref={bundleRef}
              type="file"
              accept=".json"
              aria-label="Select credential bundle JSON"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleBundleFile(f);
              }}
            />
            {bundle && <span className="file-chosen">Bundle loaded ✓</span>}
          </label>
        </div>
        {!initialBundle && (
          <div className="bundle-paste">
            <label htmlFor="bundle-text">Or paste bundle JSON:</label>
            <textarea
              id="bundle-text"
              value={bundleText}
              onChange={(e) => {
                setBundleText(e.target.value);
                try {
                  setBundle(decodeBundle(e.target.value));
                } catch {
                  setBundle(null);
                }
              }}
              rows={6}
              placeholder='{"version":1,"batchId":"...",...}'
              aria-label="Paste credential bundle JSON"
            />
          </div>
        )}
      </div>

      <button
        onClick={handleVerify}
        disabled={!canVerify || state.stage === 'loading'}
        aria-busy={state.stage === 'loading'}
        className="verify-button"
      >
        {state.stage === 'loading' ? state.message : 'Verify'}
      </button>

      {state.stage === 'done' && (
        <VerdictBlock
          result={state.result}
          fileHash={state.fileHash}
          certId={state.bundle.certId}
          batchId={state.bundle.batchId}
        />
      )}
      {state.stage === 'error' && (
        <div role="alert" className="error-block">
          {state.message}
        </div>
      )}
    </div>
  );
}
