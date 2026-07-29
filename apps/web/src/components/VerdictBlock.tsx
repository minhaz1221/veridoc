'use client';
import type { VerifyResult } from '../lib/contract';
import { VerificationStatus, getExplorerBase } from '../lib/contract';

type Props = {
  result: VerifyResult;
  fileHash: string;
  certId: string;
  batchId: string;
};

function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function VerdictBlock({ result, fileHash, certId, batchId }: Props) {
  const chainId = Number(process.env['NEXT_PUBLIC_CHAIN_ID'] ?? '11155111');
  const explorerBase = getExplorerBase(chainId);
  const issuedDate = result.issuedAt > 0n ? formatDate(result.issuedAt) : null;

  if (result.status === VerificationStatus.Valid) {
    return (
      <section
        role="region"
        aria-label="Verification result"
        aria-live="polite"
        className="verdict-block verdict-valid"
      >
        <div className="verdict-status">Valid</div>
        <p className="verdict-body">
          This document matches the record anchored on-chain by{' '}
          <strong>{result.issuerName || result.issuer}</strong>
          {issuedDate ? ` on ${issuedDate}` : ''}.
        </p>
        {result.issuerName && (
          <p className="verdict-meta">
            Issuer address: <code>{result.issuer}</code>
          </p>
        )}
        <p className="verdict-meta">Certificate ID: <code>{certId}</code></p>
        <p className="verdict-meta">Batch: <code>{batchId}</code></p>
        <p className="verdict-meta">
          File SHA-256:{' '}
          <code className="break-all">{fileHash}</code>
        </p>
      </section>
    );
  }

  if (result.status === VerificationStatus.Tampered) {
    return (
      <section
        role="region"
        aria-label="Verification result"
        aria-live="polite"
        className="verdict-block verdict-tampered"
      >
        <div className="verdict-status">Tampered</div>
        <p className="verdict-body">
          The file you uploaded does not match what{' '}
          <strong>{result.issuerName || result.issuer}</strong> anchored on{' '}
          {issuedDate ?? 'an unknown date'}.
        </p>
        <p className="verdict-body">
          This means the bytes of this file differ from the bytes that were hashed and
          anchored. Re-saving or re-printing a PDF changes its bytes, so the holder must
          submit the exact file they received — not a re-exported copy.
        </p>
        <p className="verdict-meta">Your file SHA-256: <code className="break-all">{fileHash}</code></p>
        <p className="verdict-meta">Certificate ID: <code>{certId}</code></p>
      </section>
    );
  }

  if (result.status === VerificationStatus.Revoked) {
    const revokedDate = result.revokedAt > 0n ? formatDate(result.revokedAt) : 'an unknown date';
    return (
      <section
        role="region"
        aria-label="Verification result"
        aria-live="polite"
        className="verdict-block verdict-revoked"
      >
        <div className="verdict-status">Revoked</div>
        <p className="verdict-body">
          This credential was genuine and has since been withdrawn by{' '}
          <strong>{result.issuerName || result.issuer}</strong> on {revokedDate}.
        </p>
        {result.revokeReason && (
          <p className="verdict-body">
            Reason: <em>{result.revokeReason}</em>
          </p>
        )}
        <p className="verdict-meta">Certificate ID: <code>{certId}</code></p>
        <p className="verdict-meta">Batch: <code>{batchId}</code></p>
        <p className="verdict-meta">Issued: {issuedDate ?? '—'}</p>
      </section>
    );
  }

  // Unknown
  return (
    <section
      role="region"
      aria-label="Verification result"
      aria-live="polite"
      className="verdict-block verdict-unknown"
    >
      <div className="verdict-status">Unknown</div>
      <p className="verdict-body">
        No record was found for this batch ID on the blockchain. The credential may
        not have been anchored, or the batch ID is incorrect.
      </p>
      <p className="verdict-meta">Batch ID: <code>{batchId}</code></p>
    </section>
  );
}
