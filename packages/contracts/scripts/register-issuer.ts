import { ethers } from 'hardhat';

async function main() {
  const contractAddress = process.env['CONTRACT_ADDRESS'];
  if (!contractAddress) {
    throw new Error(
      'Missing required environment variable CONTRACT_ADDRESS. ' +
        'Set it to the deployed VeriDoc contract address before running this script.',
    );
  }

  const issuerName = process.env['ISSUER_NAME'] ?? 'IIUC';

  const [signer] = await ethers.getSigners();
  const veridoc = await ethers.getContractAt('VeriDoc', contractAddress, signer);

  const issuerRole = await veridoc.ISSUER_ROLE();
  const alreadyIssuer = await veridoc.hasRole(issuerRole, signer.address);

  if (alreadyIssuer) {
    console.log(`${signer.address} already holds ISSUER_ROLE on ${contractAddress} — nothing to do.`);
    return;
  }

  console.log(`Registering ${signer.address} as issuer ("${issuerName}") on ${contractAddress}...`);
  const tx = await veridoc.registerIssuer(signer.address, issuerName);
  console.log(`Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt?.blockNumber}. ${signer.address} now holds ISSUER_ROLE.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
