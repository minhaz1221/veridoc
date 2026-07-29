import { ethers } from 'ethers';
import type { CertificateLeaf } from '@veridoc/core';
import { leafHash } from '@veridoc/core';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the ABI from compiled artifacts
function loadAbi(): unknown[] {
  // Try several locations depending on whether we're running from src or dist
  const candidates = [
    join(__dirname, '../../node_modules/@veridoc/contracts/artifacts/contracts/VeriDoc.sol/VeriDoc.json'),
    join(__dirname, '../../../contracts/artifacts/contracts/VeriDoc.sol/VeriDoc.json'),
    join(__dirname, '../../../../packages/contracts/artifacts/contracts/VeriDoc.sol/VeriDoc.json'),
  ];

  for (const candidate of candidates) {
    try {
      const artifact = JSON.parse(readFileSync(candidate, 'utf8')) as { abi: unknown[] };
      return artifact.abi;
    } catch {
      // try next
    }
  }
  throw new Error(
    'Could not find VeriDoc.json artifact. Run `pnpm --filter @veridoc/contracts build` first.',
  );
}

export function getProvider(network: string): ethers.JsonRpcProvider {
  if (network === 'sepolia') {
    const rpcUrl = process.env['SEPOLIA_RPC_URL'];
    if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL environment variable is required');
    return new ethers.JsonRpcProvider(rpcUrl);
  }
  if (network === 'localhost' || network === 'local') {
    return new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  }
  return new ethers.JsonRpcProvider(network);
}

export function getContract(address: string, provider: ethers.ContractRunner) {
  const abi = loadAbi();
  return new ethers.Contract(address, abi as ethers.InterfaceAbi, provider);
}

export function getSigner(provider: ethers.JsonRpcProvider): ethers.Wallet {
  const pk = process.env['DEPLOYER_PRIVATE_KEY'];
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY environment variable is required');
  return new ethers.Wallet(pk, provider);
}

export function getContractAddress(): string {
  const addr = process.env['CONTRACT_ADDRESS'] ?? process.env['NEXT_PUBLIC_CONTRACT_ADDRESS'];
  if (!addr) throw new Error('CONTRACT_ADDRESS or NEXT_PUBLIC_CONTRACT_ADDRESS env var required');
  return addr;
}
