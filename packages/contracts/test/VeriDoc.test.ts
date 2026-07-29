import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { VeriDoc } from '../typechain-types';
import { buildBatchTree, leafHash, getProof, generateSalt, hashFile } from '@veridoc/core';
import type { CertificateLeaf } from '@veridoc/core';

// ─── helpers ──────────────────────────────────────────────────────────────────

function randomBytes32(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

function makeLeaf(i: number): CertificateLeaf {
  return {
    fileSha256: `0x${i.toString(16).padStart(64, '0')}` as `0x${string}`,
    certId: `cert-${i}`,
    salt: generateSalt(),
  };
}

async function fileHash(content: string): Promise<`0x${string}`> {
  const bytes = new TextEncoder().encode(content);
  return hashFile(bytes);
}

// ─── suite ────────────────────────────────────────────────────────────────────

describe('VeriDoc', function () {
  let veridoc: VeriDoc;
  let admin: HardhatEthersSigner;
  let issuer: HardhatEthersSigner;
  let issuerB: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const ISSUER_NAME = 'Acme University';
  const ISSUER_NAME_B = 'Beta College';

  beforeEach(async () => {
    [admin, issuer, issuerB, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('VeriDoc');
    veridoc = (await Factory.deploy(admin.address)) as VeriDoc;
    await veridoc.waitForDeployment();

    // Register issuers
    await veridoc.connect(admin).registerIssuer(issuer.address, ISSUER_NAME);
    await veridoc.connect(admin).registerIssuer(issuerB.address, ISSUER_NAME_B);
  });

  // ── happy path ─────────────────────────────────────────────────────────────

  describe('happy path — anchor + verify Valid', () => {
    it('returns Valid for a correct proof', async () => {
      const leaf = makeLeaf(1);
      const tree = buildBatchTree([leaf]);
      const lh = leafHash(leaf) as string;
      const proof = getProof(tree, leaf) as string[];
      const batchId = randomBytes32();

      await veridoc.connect(issuer).anchorBatch(batchId, tree.root, '');

      const result = await veridoc.verify(batchId, lh, proof);
      expect(result.status).to.equal(1n); // Valid
      expect(result.issuer).to.equal(issuer.address);
      expect(result.issuerName).to.equal(ISSUER_NAME);
      expect(result.issuedAt).to.be.greaterThan(0n);
    });
  });

  // ── tampered file ──────────────────────────────────────────────────────────

  describe('Tampered', () => {
    it('returns Tampered when one byte of the file changes', async () => {
      const originalHash = await fileHash('CGPA: 3.9');
      const tamperedHash = await fileHash('CGPA: 3.0'); // one digit changed

      const salt = generateSalt();
      const originalLeaf: CertificateLeaf = { fileSha256: originalHash, certId: 'c1', salt };
      const tamperedLeaf: CertificateLeaf = { fileSha256: tamperedHash, certId: 'c1', salt };

      const tree = buildBatchTree([originalLeaf]);
      const batchId = randomBytes32();
      await veridoc.connect(issuer).anchorBatch(batchId, tree.root, '');

      // Construct a fake proof for the tampered hash — use original proof with wrong leaf hash
      const lh = leafHash(tamperedLeaf) as string;
      const result = await veridoc.verify(batchId, lh, []);
      expect(result.status).to.equal(2n); // Tampered
    });

    it('returns Tampered for a proof from a different batch', async () => {
      const leaf = makeLeaf(42);
      const treeA = buildBatchTree([leaf]);
      const treeB = buildBatchTree([makeLeaf(99)]);
      const batchIdA = randomBytes32();
      const batchIdB = randomBytes32();

      await veridoc.connect(issuer).anchorBatch(batchIdA, treeA.root, '');
      await veridoc.connect(issuer).anchorBatch(batchIdB, treeB.root, '');

      const lh = leafHash(leaf) as string;
      const proofFromA = getProof(treeA, leaf) as string[];

      // Proof from batch A presented against batch B → Tampered
      const result = await veridoc.verify(batchIdB, lh, proofFromA);
      expect(result.status).to.equal(2n); // Tampered
    });
  });

  // ── revocation ─────────────────────────────────────────────────────────────

  describe('Revoked', () => {
    it('returns Revoked even though the proof is valid', async () => {
      const leaf = makeLeaf(5);
      const tree = buildBatchTree([leaf]);
      const lh = leafHash(leaf) as string;
      const proof = getProof(tree, leaf) as string[];
      const batchId = randomBytes32();

      await veridoc.connect(issuer).anchorBatch(batchId, tree.root, '');
      await veridoc.connect(issuer).revoke(batchId, lh, 'Academic misconduct');

      const result = await veridoc.verify(batchId, lh, proof);
      expect(result.status).to.equal(3n); // Revoked
      expect(result.revokeReason).to.equal('Academic misconduct');
      expect(result.revokedAt).to.be.greaterThan(0n);
    });

    it('revokeMany revokes all supplied leaves', async () => {
      const leaves = [makeLeaf(10), makeLeaf(11), makeLeaf(12)];
      const tree = buildBatchTree(leaves);
      const batchId = randomBytes32();
      await veridoc.connect(issuer).anchorBatch(batchId, tree.root, '');

      const hashes = leaves.map((l) => leafHash(l) as string);
      await veridoc.connect(issuer).revokeMany(batchId, hashes, 'Batch revocation');

      for (let i = 0; i < leaves.length; i++) {
        const proof = getProof(tree, leaves[i]!) as string[];
        const result = await veridoc.verify(batchId, hashes[i]!, proof);
        expect(result.status).to.equal(3n); // Revoked
      }
    });
  });

  // ── unknown batch ──────────────────────────────────────────────────────────

  describe('Unknown', () => {
    it('returns Unknown for a batchId never anchored', async () => {
      const result = await veridoc.verify(randomBytes32(), randomBytes32(), []);
      expect(result.status).to.equal(0n); // Unknown
    });
  });

  // ── access control ─────────────────────────────────────────────────────────

  describe('access control', () => {
    it('non-issuer cannot anchorBatch', async () => {
      await expect(
        veridoc.connect(stranger).anchorBatch(randomBytes32(), randomBytes32(), ''),
      ).to.be.reverted;
    });

    it('issuer B cannot revoke issuer A credential', async () => {
      const leaf = makeLeaf(1);
      const tree = buildBatchTree([leaf]);
      const batchId = randomBytes32();
      await veridoc.connect(issuer).anchorBatch(batchId, tree.root, '');

      const lh = leafHash(leaf) as string;
      await expect(
        veridoc.connect(issuerB).revoke(batchId, lh, 'Unauthorized'),
      ).to.be.revertedWithCustomError(veridoc, 'NotBatchIssuer');
    });
  });

  // ── duplicate batchId ──────────────────────────────────────────────────────

  describe('duplicate batchId', () => {
    it('reverts with BatchAlreadyExists', async () => {
      const batchId = randomBytes32();
      await veridoc.connect(issuer).anchorBatch(batchId, randomBytes32(), '');
      await expect(
        veridoc.connect(issuer).anchorBatch(batchId, randomBytes32(), ''),
      ).to.be.revertedWithCustomError(veridoc, 'BatchAlreadyExists');
    });
  });

  // ── events ─────────────────────────────────────────────────────────────────

  describe('events', () => {
    it('emits BatchAnchored', async () => {
      const batchId = randomBytes32();
      const root = randomBytes32();
      await expect(veridoc.connect(issuer).anchorBatch(batchId, root, 'ipfs://meta'))
        .to.emit(veridoc, 'BatchAnchored')
        .withArgs(batchId, root, issuer.address, anyBigInt, 'ipfs://meta');
    });

    it('emits CredentialRevoked', async () => {
      const leaf = makeLeaf(1);
      const tree = buildBatchTree([leaf]);
      const batchId = randomBytes32();
      await veridoc.connect(issuer).anchorBatch(batchId, tree.root, '');
      const lh = leafHash(leaf) as string;
      await expect(veridoc.connect(issuer).revoke(batchId, lh, 'test'))
        .to.emit(veridoc, 'CredentialRevoked')
        .withArgs(lh, issuer.address, anyBigInt, 'test');
    });

    it('emits IssuerRegistered', async () => {
      const addr = stranger.address;
      await expect(veridoc.connect(admin).registerIssuer(addr, 'New Uni'))
        .to.emit(veridoc, 'IssuerRegistered')
        .withArgs(addr, 'New Uni');
    });
  });

  // ── gas snapshot ───────────────────────────────────────────────────────────

  describe('gas snapshot', () => {
    it('measures anchorBatch gas (1-leaf tree)', async () => {
      const leaf = makeLeaf(0);
      const tree = buildBatchTree([leaf]);
      const batchId = randomBytes32();
      const tx = await veridoc.connect(issuer).anchorBatch(batchId, tree.root, 'ipfs://meta');
      const receipt = await tx.wait();
      const gas = receipt?.gasUsed ?? 0n;
      console.log(`\n  anchorBatch (1-leaf): ${gas.toString()} gas`);
      expect(gas).to.be.greaterThan(0n);
    });

    it('measures revokeMany gas (50 leaves)', async () => {
      const leaves = Array.from({ length: 50 }, (_, i) => makeLeaf(i));
      const tree = buildBatchTree(leaves);
      const batchId = randomBytes32();
      await veridoc.connect(issuer).anchorBatch(batchId, tree.root, '');

      const hashes = leaves.map((l) => leafHash(l) as string);
      const tx = await veridoc.connect(issuer).revokeMany(batchId, hashes, 'mass revoke');
      const receipt = await tx.wait();
      const gas = receipt?.gasUsed ?? 0n;
      console.log(`  revokeMany (50 leaves): ${gas.toString()} gas`);
      expect(gas).to.be.greaterThan(0n);
    });
  });
});

// Chai matcher helper for bigint wildcards in event args
function anyBigInt(val: unknown): boolean {
  return typeof val === 'bigint';
}
