/**
 * End-to-end test: batch → anchor → inspect(original)=Valid → inspect(tampered)=Tampered →
 * revoke → inspect(original)=Revoked
 *
 * Runs against a local Hardhat node. Requires the node to be running on :8545.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ethers } from 'ethers';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  hashFile,
  generateSalt,
  buildBatchTree,
  getProof,
  leafHash,
  encodeBundle,
  decodeBundle,
} from '@veridoc/core';
import type { CertificateLeaf, CredentialBundle } from '@veridoc/core';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function makePdf(cgpa: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(`Test Certificate — CGPA: ${cgpa}`, { x: 100, y: 700, size: 14, font });
  page.drawText('Alice Johnson — Computer Science — 2024-06-15', { x: 100, y: 660, size: 12, font });
  return doc.save();
}

function loadArtifact(): { abi: ethers.InterfaceAbi; bytecode: string } {
  const candidates = [
    resolve('../../packages/contracts/artifacts/contracts/VeriDoc.sol/VeriDoc.json'),
    resolve('../contracts/artifacts/contracts/VeriDoc.sol/VeriDoc.json'),
    resolve('../../../packages/contracts/artifacts/contracts/VeriDoc.sol/VeriDoc.json'),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as { abi: ethers.InterfaceAbi; bytecode: string };
    } catch { /* try next */ }
  }
  throw new Error('Could not find VeriDoc.json artifact — run pnpm --filter @veridoc/contracts build first');
}

type ContractFn = (...args: unknown[]) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
type VerifyResult = { status: bigint; revokeReason: string };

// ─── suite ────────────────────────────────────────────────────────────────────

describe('CLI e2e loop', () => {
  let contract: ethers.Contract;
  let contractAddress: string;
  let batchDir: string;
  let batchId: string;
  let batchIdBytes32: string;
  let originalPdf: Uint8Array;
  let tamperedPdf: Uint8Array;
  let leafData: CertificateLeaf;
  let bundle: CredentialBundle;
  let nodeAvailable = false;

  beforeAll(async () => {
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    try {
      await provider.getBlockNumber();
      nodeAvailable = true;
    } catch {
      console.warn('No local Hardhat node found — skipping e2e tests');
      return;
    }

    const accounts = await provider.listAccounts();
    if (accounts.length < 2) throw new Error('Need at least 2 accounts');
    const admin = accounts[0]!;
    const issuer = accounts[1]!;
    const adminAddr = await admin.getAddress();
    const issuerAddr = await issuer.getAddress();

    const artifact = loadArtifact();
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, admin);
    const deployed = await factory.deploy(adminAddr);
    await deployed.waitForDeployment();
    contractAddress = await deployed.getAddress();

    const adminContract = new ethers.Contract(contractAddress, artifact.abi, admin);
    const registerFn = adminContract['registerIssuer'] as ContractFn;
    const regTx = await registerFn(issuerAddr, 'Test University');
    await regTx.wait();

    contract = new ethers.Contract(contractAddress, artifact.abi, issuer);

    originalPdf = await makePdf('3.9');
    tamperedPdf = await makePdf('3.0');

    batchDir = mkdtempSync(join(tmpdir(), 'veridoc-e2e-'));
    writeFileSync(join(batchDir, 'original.pdf'), originalPdf);
    writeFileSync(join(batchDir, 'tampered.pdf'), tamperedPdf);

    // Build tree and anchor
    const fileSha256 = await hashFile(originalPdf);
    const salt = generateSalt();
    const certId = 'CERT-E2E-001';
    leafData = { fileSha256, certId, salt };

    const tree = buildBatchTree([leafData]);
    const proof = getProof(tree, leafData);
    batchId = `e2e-batch-${Date.now()}`;
    batchIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(batchId));

    bundle = {
      version: 1,
      batchId,
      certId,
      salt,
      fileSha256,
      proof,
      contractAddress: contractAddress as `0x${string}`,
      chainId: 31337,
      issuerName: 'Test University',
    };

    writeFileSync(join(batchDir, 'bundle.json'), encodeBundle(bundle));

    const anchorFn = contract['anchorBatch'] as ContractFn;
    const tx = await anchorFn(batchIdBytes32, tree.root, '');
    await tx.wait();
  });

  it('inspect(original) = Valid', async () => {
    if (!nodeAvailable) return;

    const b = decodeBundle(readFileSync(join(batchDir, 'bundle.json'), 'utf8'));
    const pdfBytes = readFileSync(join(batchDir, 'original.pdf'));
    const actualHash = await hashFile(pdfBytes);
    expect(actualHash).toBe(b.fileSha256);

    const lh = leafHash({ fileSha256: b.fileSha256, certId: b.certId, salt: b.salt });
    const bId = ethers.keccak256(ethers.toUtf8Bytes(b.batchId));
    const verifyFn = contract['verify'] as (...args: unknown[]) => Promise<VerifyResult>;
    const result = await verifyFn(bId, lh, b.proof);
    expect(result.status).toBe(1n); // Valid
  });

  it('inspect(tampered) = Tampered', async () => {
    if (!nodeAvailable) return;

    const b = decodeBundle(readFileSync(join(batchDir, 'bundle.json'), 'utf8'));
    const tamperedBytes = readFileSync(join(batchDir, 'tampered.pdf'));
    const tamperedHash = await hashFile(tamperedBytes);
    expect(tamperedHash).not.toBe(b.fileSha256);

    const tamperedLeaf: CertificateLeaf = { fileSha256: tamperedHash, certId: b.certId, salt: b.salt };
    const tamperedLh = leafHash(tamperedLeaf);
    const bId = ethers.keccak256(ethers.toUtf8Bytes(b.batchId));
    const verifyFn = contract['verify'] as (...args: unknown[]) => Promise<VerifyResult>;
    const result = await verifyFn(bId, tamperedLh, b.proof);
    expect(result.status).toBe(2n); // Tampered
  });

  it('revoke → inspect(original) = Revoked', async () => {
    if (!nodeAvailable) return;

    const b = decodeBundle(readFileSync(join(batchDir, 'bundle.json'), 'utf8'));
    const lh = leafHash({ fileSha256: b.fileSha256, certId: b.certId, salt: b.salt });
    const bId = ethers.keccak256(ethers.toUtf8Bytes(b.batchId));

    const revokeFn = contract['revoke'] as ContractFn;
    const tx = await revokeFn(bId, lh, 'E2E test revocation');
    await tx.wait();

    const verifyFn = contract['verify'] as (...args: unknown[]) => Promise<VerifyResult>;
    const result = await verifyFn(bId, lh, b.proof);
    expect(result.status).toBe(3n); // Revoked
    expect(result.revokeReason).toBe('E2E test revocation');
  });
});
