import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ethers } from 'ethers';
import { decodeBundle, leafHash, hashFile } from '@veridoc/core';
import { getProvider, getContract, getContractAddress } from '../lib/contract.js';
import '../env.js';

export type InspectOptions = {
  bundle: string;
  file: string;
  network?: string;
  contractAddress?: string;
};

const STATUS_LABELS = ['Unknown', 'Valid', 'Tampered', 'Revoked'] as const;

type VerifyResult = {
  status: bigint;
  issuer: string;
  issuerName: string;
  issuedAt: bigint;
  revokedAt: bigint;
  revokeReason: string;
};

export async function runInspect(opts: InspectOptions): Promise<void> {
  const bundle = decodeBundle(readFileSync(resolve(opts.bundle), 'utf8'));
  const fileBytes = readFileSync(resolve(opts.file));
  const actualHash = await hashFile(fileBytes);

  console.log(`Bundle certId:   ${bundle.certId}`);
  console.log(`Bundle hash:     ${bundle.fileSha256}`);
  console.log(`Actual hash:     ${actualHash}`);

  if (actualHash !== bundle.fileSha256) {
    console.log(`\n⚠  File hash does not match bundle — this file has been modified.`);
    console.log(`   Status: TAMPERED (pre-chain check)`);
    process.exit(2);
  }

  const contractAddress = opts.contractAddress ?? bundle.contractAddress ?? getContractAddress();
  const networkOrRpc = opts.network ?? 'localhost';
  const provider = getProvider(networkOrRpc);
  const contract = getContract(contractAddress, provider);

  const lh = leafHash({ fileSha256: bundle.fileSha256, certId: bundle.certId, salt: bundle.salt });
  const batchIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(bundle.batchId));

  const verifyFn = contract['verify'] as (...args: unknown[]) => Promise<VerifyResult>;
  const result = await verifyFn(batchIdBytes32, lh, bundle.proof);

  const statusLabel = STATUS_LABELS[Number(result.status)] ?? 'Unknown';
  const issuedDate = new Date(Number(result.issuedAt) * 1000).toISOString();

  console.log(`\nChain result:`);
  console.log(`  Status:     ${statusLabel}`);
  console.log(`  Issuer:     ${result.issuerName} (${result.issuer})`);
  console.log(`  Issued at:  ${issuedDate}`);

  if (statusLabel === 'Revoked') {
    const revokedDate = new Date(Number(result.revokedAt) * 1000).toISOString();
    console.log(`  Revoked at: ${revokedDate}`);
    console.log(`  Reason:     ${result.revokeReason}`);
  }

  const exitCode = { Unknown: 3, Valid: 0, Tampered: 2, Revoked: 1 } as const;
  process.exit(exitCode[statusLabel] ?? 3);
}
