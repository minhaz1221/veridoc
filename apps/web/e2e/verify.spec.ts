import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ethers } from 'ethers';
import {
  hashFile,
  generateSalt,
  buildBatchTree,
  getProof,
  leafHash,
  encodeBundle,
} from '@veridoc/core';
import type { CertificateLeaf, CredentialBundle } from '@veridoc/core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const CONTRACT_ADDRESS = process.env['NEXT_PUBLIC_CONTRACT_ADDRESS'] ?? '';
const RPC_URL = process.env['NEXT_PUBLIC_RPC_URL'] ?? 'http://127.0.0.1:8545';

const VERIDOC_ABI = [
  'function anchorBatch(bytes32 batchId, bytes32 root, string calldata metaURI)',
  'function revoke(bytes32 batchId, bytes32 leaf, string calldata reason)',
  'function registerIssuer(address issuer, string calldata name)',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function ISSUER_ROLE() external view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() external view returns (bytes32)',
];

async function makePdf(cgpa: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(`Test Certificate — CGPA: ${cgpa}`, { x: 100, y: 700, size: 14, font });
  return Buffer.from(await doc.save());
}

test.describe('VeriDoc verify flow', () => {
  let originalPdf: Buffer;
  let tamperedPdf: Buffer;
  let bundle: CredentialBundle;
  let batchId: string;

  test.beforeAll(async () => {
    if (!CONTRACT_ADDRESS) {
      test.skip();
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const accounts = await provider.listAccounts();
    const admin = accounts[0]!;
    const issuer = accounts[1]!;

    const adminAddr = await admin.getAddress();
    const issuerAddr = await issuer.getAddress();

    const issuerContract = new ethers.Contract(CONTRACT_ADDRESS, VERIDOC_ABI, issuer);
    const adminContract = new ethers.Contract(CONTRACT_ADDRESS, VERIDOC_ABI, admin);

    // Ensure issuer role
    const issuerRole = await (adminContract['ISSUER_ROLE'] as () => Promise<string>)();
    const isIssuer = await (adminContract['hasRole'] as (...a: unknown[]) => Promise<boolean>)(issuerRole, issuerAddr);
    if (!isIssuer) {
      const tx = await (adminContract['registerIssuer'] as (...a: unknown[]) => Promise<{ hash: string; wait: () => Promise<unknown> }>)(issuerAddr, 'Test University');
      await tx.wait();
    }

    originalPdf = await makePdf('3.9');
    tamperedPdf = await makePdf('3.0');

    const fileSha256 = await hashFile(originalPdf);
    const salt = generateSalt();
    const certId = 'PW-E2E-001';
    const leaf: CertificateLeaf = { fileSha256, certId, salt };
    const tree = buildBatchTree([leaf]);
    const proof = getProof(tree, leaf);
    batchId = `pw-e2e-${Date.now()}`;
    const batchIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(batchId));

    bundle = {
      version: 1,
      batchId,
      certId,
      salt,
      fileSha256,
      proof,
      contractAddress: CONTRACT_ADDRESS as `0x${string}`,
      chainId: 31337,
      issuerName: 'Test University',
    };

    const anchorFn = issuerContract['anchorBatch'] as (...a: unknown[]) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
    await (await anchorFn(batchIdBytes32, tree.root, '')).wait();
  });

  test('verify page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Verification');
  });

  test('demo page loads and shows hash comparison UI', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.locator('h1')).toContainText('How It Works');
    await expect(page.locator('button')).toContainText('Compare Hashes');
  });

  test('verify page: upload untampered file → Valid', async ({ page }) => {
    if (!CONTRACT_ADDRESS) test.skip();

    await page.goto('/');

    // Upload PDF via file input
    const [pdfInput] = page.locator('input[type="file"][accept=".pdf"]').all()
      ? await page.locator('input[type="file"][accept=".pdf"]').all()
      : [];

    if (!pdfInput) {
      test.skip();
      return;
    }

    await pdfInput.setInputFiles({
      name: 'cert.pdf',
      mimeType: 'application/pdf',
      buffer: originalPdf,
    });

    // Upload bundle JSON
    const bundleJson = encodeBundle(bundle);
    const [jsonInput] = await page.locator('input[type="file"][accept=".json"]').all();
    if (jsonInput) {
      await jsonInput.setInputFiles({
        name: 'bundle.json',
        mimeType: 'application/json',
        buffer: Buffer.from(bundleJson),
      });
    }

    await page.locator('button.verify-button').click();
    await expect(page.locator('[aria-live="polite"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.verdict-valid')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.verdict-status')).toContainText('Valid');
  });

  test('verify page: upload tampered file → Tampered', async ({ page }) => {
    if (!CONTRACT_ADDRESS) test.skip();

    await page.goto('/');

    const [pdfInput] = await page.locator('input[type="file"][accept=".pdf"]').all();
    if (!pdfInput) { test.skip(); return; }

    await pdfInput.setInputFiles({
      name: 'tampered.pdf',
      mimeType: 'application/pdf',
      buffer: tamperedPdf,
    });

    const bundleJson = encodeBundle(bundle);
    const [jsonInput] = await page.locator('input[type="file"][accept=".json"]').all();
    if (jsonInput) {
      await jsonInput.setInputFiles({
        name: 'bundle.json',
        mimeType: 'application/json',
        buffer: Buffer.from(bundleJson),
      });
    }

    await page.locator('button.verify-button').click();
    await expect(page.locator('[aria-live="polite"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.verdict-tampered')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.verdict-status')).toContainText('Tampered');
  });
});
