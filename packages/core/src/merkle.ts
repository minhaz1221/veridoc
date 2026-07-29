import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import type { CertificateLeaf, Hex } from './types.js';

type LeafTuple = [Hex, string, Hex];

const LEAF_ENCODING = ['bytes32', 'string', 'bytes32'] as const;

function toTuple(leaf: CertificateLeaf): LeafTuple {
  return [leaf.fileSha256, leaf.certId, leaf.salt];
}

export function buildBatchTree(
  leaves: CertificateLeaf[],
): StandardMerkleTree<LeafTuple> {
  if (leaves.length === 0) {
    throw new Error('Cannot build a tree with zero leaves');
  }
  const tuples = leaves.map(toTuple);
  return StandardMerkleTree.of(tuples, [...LEAF_ENCODING]);
}

export function leafHash(leaf: CertificateLeaf): Hex {
  // Build a single-leaf tree to extract the double-hashed leaf value.
  // This guarantees the hash matches exactly what StandardMerkleTree produces.
  const tree = StandardMerkleTree.of([toTuple(leaf)], [...LEAF_ENCODING]);
  for (const [, value] of tree.entries()) {
    return tree.leafHash(value) as Hex;
  }
  throw new Error('unreachable');
}

export function getProof(
  tree: StandardMerkleTree<LeafTuple>,
  leaf: CertificateLeaf,
): Hex[] {
  for (const [index, value] of tree.entries()) {
    if (
      value[0] === leaf.fileSha256 &&
      value[1] === leaf.certId &&
      value[2] === leaf.salt
    ) {
      return tree.getProof(index) as Hex[];
    }
  }
  throw new Error(`Leaf not found in tree: certId=${leaf.certId}`);
}
