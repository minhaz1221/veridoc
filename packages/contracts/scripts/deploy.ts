import { ethers, network } from 'hardhat';

function requireEnv(name: 'SEPOLIA_RPC_URL' | 'DEPLOYER_PRIVATE_KEY'): void {
  if (!process.env[name]) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Create a .env file at the repository root (see .env.example) and set it there.',
    );
  }
}

async function main() {
  if (network.name === 'sepolia') {
    requireEnv('SEPOLIA_RPC_URL');
    requireEnv('DEPLOYER_PRIVATE_KEY');
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying VeriDoc with account: ${deployer.address}`);

  const VeriDoc = await ethers.getContractFactory('VeriDoc');
  const veridoc = await VeriDoc.deploy(deployer.address);
  await veridoc.waitForDeployment();

  const address = await veridoc.getAddress();
  console.log(`VeriDoc deployed to: ${address}`);
  console.log(`Admin: ${deployer.address}`);
  console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);

  return address;
}

main()
  .then((address) => {
    console.log(`\nDeployment complete: ${address}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
