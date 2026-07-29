import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { hashFile, generateSalt, buildBatchTree, getProof, leafHash, encodeBundle } from '@veridoc/core';
import type { CertificateLeaf, CredentialBundle } from '@veridoc/core';
import { parseManifest } from '../lib/csv.js';
import QRCode from 'qrcode';

export type BatchOptions = {
  input: string;
  manifest: string;
  out: string;
  batchId?: string;
  webUrl?: string;
  contractAddress?: string;
  chainId?: number;
  issuerName?: string;
};

export type BatchJson = {
  batchId: string;
  root: string;
  leafCount: number;
  createdAt: string;
  contractAddress: string;
  chainId: number;
  issuerName: string;
};

export async function runBatch(opts: BatchOptions): Promise<void> {
  const inputDir = resolve(opts.input);
  const manifestPath = resolve(opts.manifest);
  const batchId = opts.batchId ?? `batch-${Date.now()}`;
  const outDir = resolve(opts.out);
  const webUrl = opts.webUrl ?? process.env['WEB_URL'] ?? 'http://localhost:3000';
  const contractAddress = opts.contractAddress ?? process.env['CONTRACT_ADDRESS'] ?? process.env['NEXT_PUBLIC_CONTRACT_ADDRESS'] ?? '0x0000000000000000000000000000000000000000';
  const chainId = opts.chainId ?? Number(process.env['NEXT_PUBLIC_CHAIN_ID'] ?? '31337');
  const issuerName = opts.issuerName ?? 'Unknown Issuer';

  mkdirSync(outDir, { recursive: true });

  const rows = parseManifest(manifestPath);
  console.log(`Processing ${rows.length} certificates...`);

  const leaves: CertificateLeaf[] = [];
  const rowLeaves: Array<{ row: (typeof rows)[0]; leaf: CertificateLeaf }> = [];

  for (const row of rows) {
    const filePath = join(inputDir, row.filename);
    const fileBytes = readFileSync(filePath);
    const fileSha256 = await hashFile(fileBytes);
    const salt = generateSalt();

    const leaf: CertificateLeaf = { fileSha256, certId: row.certId, salt };
    leaves.push(leaf);
    rowLeaves.push({ row, leaf });
    console.log(`  Hashed ${row.filename} → ${fileSha256.slice(0, 18)}...`);
  }

  const tree = buildBatchTree(leaves);
  const root = tree.root;
  console.log(`\nBatch root: ${root}`);

  // Write batch.json
  const batchJson: BatchJson = {
    batchId,
    root,
    leafCount: leaves.length,
    createdAt: new Date().toISOString(),
    contractAddress,
    chainId,
    issuerName,
  };
  writeFileSync(join(outDir, 'batch.json'), JSON.stringify(batchJson, null, 2));

  // Write individual bundles and QR codes
  for (const { row, leaf } of rowLeaves) {
    const proof = getProof(tree, leaf);
    const lh = leafHash(leaf);

    const bundle: CredentialBundle = {
      version: 1,
      batchId,
      certId: leaf.certId,
      salt: leaf.salt,
      fileSha256: leaf.fileSha256,
      proof,
      contractAddress: contractAddress as `0x${string}`,
      chainId,
      issuerName,
    };

    const bundlePath = join(outDir, `bundle-${leaf.certId}.json`);
    writeFileSync(bundlePath, encodeBundle(bundle));

    // QR code points to verify URL; salt goes in the fragment so it's never in the request
    const verifyUrl = `${webUrl}/v/${batchId}/${leaf.certId}#s=${leaf.salt}`;
    const qrPath = join(outDir, `qr-${leaf.certId}.png`);
    await QRCode.toFile(qrPath, verifyUrl, { errorCorrectionLevel: 'M', width: 400 });

    console.log(`  Bundle + QR → ${leaf.certId} (leaf: ${lh.slice(0, 18)}...)`);
  }

  console.log(`\nDone. Output in: ${outDir}`);
  console.log(`  batch.json, ${leaves.length} bundles, ${leaves.length} QR codes`);
  console.log(`\nNext: veridoc anchor --batch ${outDir} --network <network>`);
}
