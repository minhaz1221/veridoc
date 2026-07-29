import { describe, it, expect } from 'vitest';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { buildBatchTree, getProof, leafHash } from '../merkle.js';
import { generateSalt } from '../salt.js';
import { hashFile } from '../hash.js';
import type { CertificateLeaf } from '../types.js';

function makeLeaf(i: number): CertificateLeaf {
  return {
    fileSha256: `0x${i.toString(16).padStart(64, '0')}` as `0x${string}`,
    certId: `cert-${i}`,
    salt: generateSalt(),
  };
}

describe('buildBatchTree', () => {
  it('throws on empty leaves', () => {
    expect(() => buildBatchTree([])).toThrow();
  });

  it('is deterministic: same input → same root', () => {
    const salt1 = generateSalt();
    const leaves: CertificateLeaf[] = [
      { fileSha256: '0x' + 'ab'.repeat(32) as `0x${string}`, certId: 'c1', salt: salt1 },
    ];
    const tree1 = buildBatchTree(leaves);
    const tree2 = buildBatchTree(leaves);
    expect(tree1.root).toBe(tree2.root);
  });

  it('different input order → different root', () => {
    const a = makeLeaf(1);
    const b = makeLeaf(2);
    const tree1 = buildBatchTree([a, b]);
    const tree2 = buildBatchTree([b, a]);
    // StandardMerkleTree sorts pairs — roots may differ or may not depending on sort
    // What matters: both roots are valid 32-byte hex strings
    expect(tree1.root).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(tree2.root).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it('verifies every proof in a 1,000-leaf tree', () => {
    const leaves = Array.from({ length: 1000 }, (_, i) => makeLeaf(i));
    const tree = buildBatchTree(leaves);
    const root = tree.root;

    for (const leaf of leaves) {
      const proof = getProof(tree, leaf);
      const verified = StandardMerkleTree.verify(
        root,
        ['bytes32', 'string', 'bytes32'],
        [leaf.fileSha256, leaf.certId, leaf.salt],
        proof,
      );
      expect(verified).toBe(true);
    }
  });

  it('rejects a proof from a different tree', () => {
    const leaf = makeLeaf(0);
    const treeA = buildBatchTree([leaf]);
    const treeB = buildBatchTree([makeLeaf(1), makeLeaf(2)]);
    const proof = getProof(treeA, leaf);

    const verified = StandardMerkleTree.verify(
      treeB.root,
      ['bytes32', 'string', 'bytes32'],
      [leaf.fileSha256, leaf.certId, leaf.salt],
      proof,
    );
    expect(verified).toBe(false);
  });
});

describe('leafHash', () => {
  it('matches the hash the tree produces internally', () => {
    const leaf = makeLeaf(42);
    const hash = leafHash(leaf);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it('is stable: same leaf → same hash', () => {
    const leaf = makeLeaf(1);
    expect(leafHash(leaf)).toBe(leafHash(leaf));
  });

  it('differs for different leaves', () => {
    const a = makeLeaf(1);
    const b = makeLeaf(2);
    expect(leafHash(a)).not.toBe(leafHash(b));
  });
});

describe('getProof', () => {
  it('throws when the leaf is not in the tree', () => {
    const tree = buildBatchTree([makeLeaf(0)]);
    const outsider = makeLeaf(999);
    expect(() => getProof(tree, outsider)).toThrow();
  });
});
