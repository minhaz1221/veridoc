import { ethers } from 'ethers';

const ABI = [
  'function registerIssuer(address issuer, string calldata name) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function ISSUER_ROLE() external view returns (bytes32)',
];

const contractAddress = process.argv[2] ?? process.env['CONTRACT_ADDRESS'];
if (!contractAddress) {
  console.error('Usage: node setup-issuer.mjs <contractAddress>');
  console.error('   or: CONTRACT_ADDRESS=0x... node setup-issuer.mjs');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);
const contract = new ethers.Contract(contractAddress, ABI, wallet);

const issuerRole = await contract.ISSUER_ROLE();
const isIssuer = await contract.hasRole(issuerRole, wallet.address);
if (isIssuer) {
  console.log('Already has ISSUER_ROLE');
} else {
  const tx = await contract.registerIssuer(wallet.address, 'Acme University');
  await tx.wait();
  console.log('Registered as issuer:', wallet.address);
}
