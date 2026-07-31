import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ethers } from 'ethers';
import { getProvider, getContract, getSigner, getContractAddress } from '../lib/contract.js';
import type { BatchJson } from './batch.js';
import '../env.js';

export type AnchorOptions = {
  batch: string;
  network: string;
  contractAddress?: string;
};

type TxLike = {
  hash: string;
  wait: () => Promise<{ blockNumber: number; gasUsed: bigint } | null>;
};

export async function runAnchor(opts: AnchorOptions): Promise<void> {
  const batchDir = resolve(opts.batch);
  const batchJson = JSON.parse(readFileSync(join(batchDir, 'batch.json'), 'utf8')) as BatchJson;
  const contractAddress = opts.contractAddress ?? getContractAddress();

  console.log(`Anchoring batch: ${batchJson.batchId}`);
  console.log(`Root: ${batchJson.root}`);
  console.log(`Network: ${opts.network}`);
  console.log(`Contract: ${contractAddress}`);

  const provider = getProvider(opts.network);
  const signer = getSigner(provider);
  const contract = getContract(contractAddress, signer);

  const batchIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(batchJson.batchId));

  console.log(`\nSending anchorBatch transaction...`);
  const anchorBatch = contract['anchorBatch'] as (...args: unknown[]) => Promise<TxLike>;
  const tx = await anchorBatch(batchIdBytes32, batchJson.root, `ipfs://${batchJson.batchId}`);

  console.log(`Tx hash: ${tx.hash}`);
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();

  const network = await provider.getNetwork();
  const explorerBase = getExplorerUrl(Number(network.chainId));
  const txUrl = explorerBase ? `${explorerBase}/tx/${tx.hash}` : tx.hash;

  const txJson = {
    batchId: batchJson.batchId,
    batchIdBytes32,
    txHash: tx.hash,
    blockNumber: receipt?.blockNumber,
    gasUsed: receipt?.gasUsed?.toString(),
    network: opts.network,
    contractAddress,
    explorerUrl: txUrl,
  };

  writeFileSync(join(batchDir, 'tx.json'), JSON.stringify(txJson, null, 2));

  console.log(`\nAnchored! Block: ${receipt?.blockNumber}`);
  console.log(`Explorer: ${txUrl}`);
  console.log(`\nBatch ID bytes32: ${batchIdBytes32}`);
}

function getExplorerUrl(chainId: number): string | null {
  const map: Record<number, string | null> = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    31337: null,
  };
  return map[chainId] ?? null;
}
