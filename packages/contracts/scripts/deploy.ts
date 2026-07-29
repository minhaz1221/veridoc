import { ethers } from 'hardhat';

async function main() {
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
