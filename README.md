# VeriDoc — Blockchain-Anchored Document Verification

> Verify documents with cryptographic certainty. No wallet, no upload, no trust in the issuer's servers.

## Threat model

The problem VeriDoc solves is that traditional document registries require you to trust the issuer's servers to still be online and un-tampered. VeriDoc puts the issuer inside the threat model: even if the issuing institution is compromised, shut down, or acting in bad faith, a verifier can independently confirm whether a document is authentic by checking the public blockchain.

Records are **append-only** (Merkle roots are immutable once anchored), **un-backdatable** (block timestamps), and **institution-independent** (any Ethereum node serves the truth).

**Why not just a database?** A database allows the issuer to silently delete or modify records. A blockchain does not. The immutability guarantee is the entire value proposition.

## Architecture

```
veridoc/
├── packages/core/          # Isomorphic leaf/Merkle/hashing — runs in Node and browser
├── packages/contracts/     # VeriDoc.sol — Hardhat + OpenZeppelin v5
├── packages/cli/           # Issuer batch tool: hash → tree → anchor → QR
├── apps/web/               # Next.js App Router — verify (public) + issuer dashboard
└── fixtures/               # Demo certificates (PDF + tampered copy)
```

### Leaf encoding

Each document leaf is `[fileSha256 (bytes32), certId (string), salt (bytes32)]`
encoded via `StandardMerkleTree` (double-hashed, sorted pairs). The salt prevents
brute-force preimage attacks on predictable certificate content. Salts are stored
in the credential bundle / QR code — never on-chain.

### Verification states

| State | Meaning |
|-------|---------|
| `Valid` | Proof is correct, leaf is not revoked |
| `Tampered` | The Merkle proof does not verify against the anchored root |
| `Revoked` | Proof is valid but the leaf has been explicitly revoked |
| `Unknown` | The batch ID was never anchored |

## Gas numbers (Phase 3 — measured on Hardhat local node)

| Operation | Gas used | Notes |
|-----------|----------|-------|
| `anchorBatch` (1-leaf tree) | **96,178** | Stores root + issuer + timestamp |
| `revokeMany` (50 leaves) | **2,462,647** | ~49,253 gas/leaf at scale |

At 20 gwei on Ethereum mainnet these are roughly $0.50 and $25 respectively. On L2s (Arbitrum, Base) costs are ~10–100× lower. Sepolia testnet ETH is free.

## Local setup

```bash
# Prerequisites: Node 22+, pnpm 11+
cp .env.example .env
# Fill in SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, etc.

pnpm install
pnpm -r build

# Start a local Hardhat node
cd packages/contracts && pnpm exec hardhat node

# In another terminal, deploy locally
cd packages/contracts && pnpm deploy:local

# Run the web app
cd apps/web && pnpm dev
```

## Deployed contracts

_Populated after Phase 6._

| Network | Contract address | Tx hash |
|---------|-----------------|---------|
| Sepolia | — | — |

## Known limitations

1. **PDF byte-instability**: Re-saving or re-printing a PDF changes its bytes, which changes its SHA-256 hash. Holders must submit the exact file they received, not a re-exported copy.
2. **Salt distribution**: The salt is the holder's responsibility. Losing the credential bundle (QR or JSON) means losing the ability to verify, as the salt is not recoverable from on-chain data.
3. **Testnet only**: VeriDoc currently targets Sepolia. Production deployment would require auditing and a decision on which L1/L2 best fits the cost and longevity requirements.

## Phases

- [x] Phase 1 — Monorepo scaffold
- [x] Phase 2 — `packages/core`
- [x] Phase 3 — `packages/contracts`
- [x] Phase 4 — `packages/cli`
- [ ] Phase 5 — `apps/web`
- [ ] Phase 6 — Deploy and document
