#!/usr/bin/env node
import { Command } from 'commander';
import 'dotenv/config';

const program = new Command();

program
  .name('veridoc')
  .description('VeriDoc issuer CLI — blockchain-anchored document verification')
  .version('0.0.0');

program
  .command('batch')
  .description('Hash a directory of PDFs, build the Merkle tree, write bundles and QR codes')
  .requiredOption('--input <dir>', 'Directory containing certificate PDFs')
  .requiredOption('--manifest <csv>', 'CSV manifest (filename,certId,recipientName,program,issuedOn)')
  .requiredOption('--out <dir>', 'Output directory for batch.json, bundles, and QR codes')
  .option('--batch-id <id>', 'Batch identifier (default: batch-<timestamp>)')
  .option('--web-url <url>', 'Base URL for QR codes', process.env['WEB_URL'] ?? 'http://localhost:3000')
  .option('--contract-address <addr>', 'Contract address to embed in bundles')
  .option('--chain-id <n>', 'Chain ID to embed in bundles', (v) => parseInt(v, 10))
  .option('--issuer-name <name>', 'Issuer display name to embed in bundles')
  .action(async (opts: Record<string, unknown>) => {
    const { runBatch } = await import('./commands/batch.js');
    await runBatch({
      input: opts['input'] as string,
      manifest: opts['manifest'] as string,
      out: opts['out'] as string,
      ...(opts['batchId'] != null && { batchId: opts['batchId'] as string }),
      ...(opts['webUrl'] != null && { webUrl: opts['webUrl'] as string }),
      ...(opts['contractAddress'] != null && { contractAddress: opts['contractAddress'] as string }),
      ...(opts['chainId'] != null && { chainId: opts['chainId'] as number }),
      ...(opts['issuerName'] != null && { issuerName: opts['issuerName'] as string }),
    });
  });

program
  .command('anchor')
  .description('Anchor a batch on-chain (sends transaction, waits for confirmation)')
  .requiredOption('--batch <dir>', 'Batch directory containing batch.json')
  .requiredOption('--network <network>', 'Network: sepolia, localhost, or RPC URL')
  .option('--contract-address <addr>', 'Override contract address')
  .action(async (opts: Record<string, unknown>) => {
    const { runAnchor } = await import('./commands/anchor.js');
    await runAnchor({
      batch: opts['batch'] as string,
      network: opts['network'] as string,
      ...(opts['contractAddress'] != null && { contractAddress: opts['contractAddress'] as string }),
    });
  });

program
  .command('revoke')
  .description('Revoke a single credential on-chain')
  .requiredOption('--batch <dir>', 'Batch directory containing batch.json and bundles')
  .requiredOption('--cert <certId>', 'Certificate ID to revoke')
  .requiredOption('--reason <text>', 'Revocation reason')
  .option('--network <network>', 'Network', 'sepolia')
  .option('--contract-address <addr>', 'Override contract address')
  .action(async (opts: Record<string, unknown>) => {
    const { runRevoke } = await import('./commands/revoke.js');
    await runRevoke({
      batch: opts['batch'] as string,
      cert: opts['cert'] as string,
      reason: opts['reason'] as string,
      network: opts['network'] as string,
      ...(opts['contractAddress'] != null && { contractAddress: opts['contractAddress'] as string }),
    });
  });

program
  .command('inspect')
  .description('Verify a credential locally + on-chain (no wallet required)')
  .requiredOption('--bundle <path>', 'Path to bundle JSON')
  .requiredOption('--file <path>', 'Path to the original certificate PDF')
  .option('--network <network>', 'Network or RPC URL', 'localhost')
  .option('--contract-address <addr>', 'Override contract address')
  .action(async (opts: Record<string, unknown>) => {
    const { runInspect } = await import('./commands/inspect.js');
    await runInspect({
      bundle: opts['bundle'] as string,
      file: opts['file'] as string,
      ...(opts['network'] != null && { network: opts['network'] as string }),
      ...(opts['contractAddress'] != null && { contractAddress: opts['contractAddress'] as string }),
    });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
