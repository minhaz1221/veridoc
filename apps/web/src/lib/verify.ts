'use client';
import { ethers } from 'ethers';
import { leafHash } from '@veridoc/core';
import type { CredentialBundle, Hex } from '@veridoc/core';
import { getReadProvider, getReadContract, type VerifyResult } from './contract';

export type VerificationState =
  | { stage: 'idle' }
  | { stage: 'hashing' }
  | { stage: 'querying' }
  | { stage: 'done'; result: VerifyResult; fileHash: string; bundle: CredentialBundle }
  | { stage: 'error'; message: string };

export async function verifyDocument(
  file: File,
  bundle: CredentialBundle,
): Promise<{ result: VerifyResult; fileHash: string }> {
  // Hash the file client-side — it never leaves the browser
  const arrayBuffer = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const fileHash = ('0x' + Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')) as Hex;

  const lh = leafHash({
    fileSha256: fileHash,
    certId: bundle.certId,
    salt: bundle.salt,
  });

  const batchIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(bundle.batchId));

  const provider = getReadProvider();
  const contract = getReadContract(provider);

  const result = await (contract['verify'] as (...args: unknown[]) => Promise<VerifyResult>)(
    batchIdBytes32,
    lh,
    bundle.proof,
  );

  return { result, fileHash };
}
