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

/**
 * Returns the double-hashed leaf value that StandardMerkleTree produces and
 * that VeriDoc.sol recomputes via MerkleProof.verify. This must be the
 * revocation key stored on-chain.
 *
 * We derive it from a single-leaf tree rather than reimplementing the
 * double-hash ourselves, guaranteeing byte-for-byte agreement with OZ's
 * implementation regardless of future encoding changes.
 */
export function leafHash(leaf: CertificateLeaf): Hex {
  const tree = StandardMerkleTree.of([toTuple(leaf)], [...LEAF_ENCODING]);
  for (const [index] of tree.entries()) {
    return tree.leafHash(toTuple(leaf)) as Hex;
  }
  throw new Error('unreachable: tree must have at least one leaf');
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
