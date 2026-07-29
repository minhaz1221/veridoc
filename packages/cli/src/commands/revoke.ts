import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ethers } from 'ethers';
import { decodeBundle, leafHash } from '@veridoc/core';
import { getProvider, getContract, getSigner, getContractAddress } from '../lib/contract.js';
import type { BatchJson } from './batch.js';
import 'dotenv/config';

export type RevokeOptions = {
  batch: string;
  cert: string;
  reason: string;
  network: string;
  contractAddress?: string;
};

type TxLike = {
  hash: string;
  wait: () => Promise<{ blockNumber: number } | null>;
};

export async function runRevoke(opts: RevokeOptions): Promise<void> {
  const batchDir = resolve(opts.batch);
  const batchJson = JSON.parse(readFileSync(join(batchDir, 'batch.json'), 'utf8')) as BatchJson;
  const bundle = decodeBundle(readFileSync(join(batchDir, `bundle-${opts.cert}.json`), 'utf8'));
  const contractAddress = opts.contractAddress ?? getContractAddress();

  const lh = leafHash({ fileSha256: bundle.fileSha256, certId: bundle.certId, salt: bundle.salt });
  const batchIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(batchJson.batchId));

  console.log(`Revoking cert: ${opts.cert}`);
  console.log(`Leaf hash: ${lh}`);
  console.log(`Reason: ${opts.reason}`);
  console.log(`Network: ${opts.network}`);

  const provider = getProvider(opts.network);
  const signer = getSigner(provider);
  const contract = getContract(contractAddress, signer);

  const revokeFn = contract['revoke'] as (...args: unknown[]) => Promise<TxLike>;
  const tx = await revokeFn(batchIdBytes32, lh, opts.reason);
  console.log(`Tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Revoked at block ${receipt?.blockNumber}`);
}
