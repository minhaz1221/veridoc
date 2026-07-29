import { ethers } from 'ethers';

// Minimal ABI — only what the frontend needs
const VERIDOC_ABI = [
  'function verify(bytes32 batchId, bytes32 leaf, bytes32[] calldata proof) external view returns (tuple(uint8 status, address issuer, string issuerName, uint64 issuedAt, string metaURI, uint64 revokedAt, string revokeReason))',
  'function getBatch(bytes32 batchId) external view returns (tuple(bytes32 root, address issuer, uint64 issuedAt, string metaURI))',
  'function anchorBatch(bytes32 batchId, bytes32 root, string calldata metaURI)',
  'function revoke(bytes32 batchId, bytes32 leaf, string calldata reason)',
  'function registerIssuer(address issuer, string calldata name)',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'event BatchAnchored(bytes32 indexed batchId, bytes32 root, address indexed issuer, uint64 issuedAt, string metaURI)',
  'event CredentialRevoked(bytes32 indexed leaf, address indexed revokedBy, uint64 revokedAt, string reason)',
  'function ISSUER_ROLE() external view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() external view returns (bytes32)',
] as const;

export type VerifyResult = {
  status: bigint;
  issuer: string;
  issuerName: string;
  issuedAt: bigint;
  metaURI: string;
  revokedAt: bigint;
  revokeReason: string;
};

export const VerificationStatus = {
  Unknown: 0n,
  Valid: 1n,
  Tampered: 2n,
  Revoked: 3n,
} as const;

export function getReadProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env['NEXT_PUBLIC_RPC_URL'];
  if (!rpcUrl) throw new Error('NEXT_PUBLIC_RPC_URL is not set');
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getReadContract(provider: ethers.ContractRunner): ethers.Contract {
  const address = process.env['NEXT_PUBLIC_CONTRACT_ADDRESS'];
  if (!address) throw new Error('NEXT_PUBLIC_CONTRACT_ADDRESS is not set');
  return new ethers.Contract(address, VERIDOC_ABI as unknown as ethers.InterfaceAbi, provider);
}

export function getChainId(): number {
  return Number(process.env['NEXT_PUBLIC_CHAIN_ID'] ?? '11155111');
}

export function getContractAddress(): string {
  return process.env['NEXT_PUBLIC_CONTRACT_ADDRESS'] ?? '';
}

export function getExplorerBase(chainId: number): string {
  const map: Record<number, string> = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    31337: 'http://localhost:8545',
  };
  return map[chainId] ?? 'https://etherscan.io';
}
