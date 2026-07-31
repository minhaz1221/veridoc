#!/usr/bin/env node
// Re-renders QR codes for an already-anchored batch from its existing bundle-*.json
// files, without touching salts, hashes, proofs, or the batch.json root.
//
// Use this instead of re-running `veridoc batch` when only the QR destination
// URL needs to change (e.g. after deploying the frontend) — `batch` draws fresh
// random salts on every run, which would change every leaf and invalidate the
// Merkle root already anchored on-chain.
//
// Usage:
//   node scripts/regenerate-qr.mjs --dir ../../out/batches/demo --web-url https://example.com

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import QRCode from 'qrcode';

function parseArgs(argv) {
  const args = { dir: undefined, webUrl: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') args.dir = argv[++i];
    else if (argv[i] === '--web-url') args.webUrl = argv[++i];
  }
  if (!args.dir) throw new Error('Usage: regenerate-qr.mjs --dir <batchDir> --web-url <url>');
  if (!args.webUrl) throw new Error('Usage: regenerate-qr.mjs --dir <batchDir> --web-url <url>');
  return args;
}

const { dir, webUrl } = parseArgs(process.argv.slice(2));
const batchDir = resolve(dir);

const bundleFiles = readdirSync(batchDir).filter((f) => f.startsWith('bundle-') && f.endsWith('.json'));
if (bundleFiles.length === 0) {
  throw new Error(`No bundle-*.json files found in ${batchDir}`);
}

console.log(`Regenerating ${bundleFiles.length} QR codes in ${batchDir} against ${webUrl}...`);

for (const file of bundleFiles) {
  const bundle = JSON.parse(readFileSync(join(batchDir, file), 'utf8'));
  const verifyUrl = `${webUrl}/v/${bundle.batchId}/${bundle.certId}#s=${bundle.salt}`;
  const qrPath = join(batchDir, `qr-${bundle.certId}.png`);
  await QRCode.toFile(qrPath, verifyUrl, { errorCorrectionLevel: 'M', width: 400 });
  console.log(`  ${bundle.certId} → ${qrPath}`);
}

console.log('Done.');
