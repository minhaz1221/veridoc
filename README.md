# VeriDoc — Blockchain-Anchored Document Verification

> Verify documents with cryptographic certainty. No wallet, no upload, no trust in the issuer's servers.

## Threat model

The problem VeriDoc solves is that traditional document registries require you to trust the issuer's servers to still be online and un-tampered. VeriDoc puts the issuer inside the threat model: even if the issuing institution is compromised, shut down, or acting in bad faith, a verifier can independently confirm whether a document is authentic by checking the public blockchain.

Records are **append-only** (Merkle roots are immutable once anchored), **un-backdatable** (block timestamps), and **institution-independent** (any Ethereum node serves the truth).

**Why not just a database?** A database controlled by the issuer allows silent deletion or modification of records without any public trace. A blockchain does not. The immutability guarantee is the entire value proposition — it means the issuer cannot rewrite history.

## Architecture

```
┌─────────────────── Issuer (trusted once, then irrelevant) ──────────────────┐
│                                                                               │
│  PDFs + manifest.csv                                                          │
│       │                                                                       │
│       ▼                                                                       │
│  veridoc batch  ──→  SHA-256 each file + random salt  ──→  Merkle tree       │
│       │                                                         │             │
│       │          bundle-<certId>.json (salt + proof + hash)     │             │
│       │          qr-<certId>.png                                │             │
│       ▼                                                         ▼             │
│  veridoc anchor  ─────────────────────────────────────→  Ethereum tx         │
│                                                         anchorBatch(batchId, │
│                                                           root, metaURI)     │
└───────────────────────────────────────────────────────────────────────────────┘

        Document holder receives: PDF + bundle JSON / QR code

┌─────────────────── Verifier (no wallet, no trust required) ─────────────────┐
│                                                                               │
│  Upload PDF ──→ crypto.subtle.digest('SHA-256') ─(never leaves browser)─→   │
│                          │                                                    │
│  Load bundle JSON / QR ─→  leafHash(sha256, certId, salt) ─────────────→    │
│                                                                               │
│  JsonRpcProvider.call(verify(batchId, leafHash, proof))                       │
│       │                                                                       │
│       ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  VeriDoc.sol                                                            │ │
│  │  verify(batchId, leaf, proof):                                          │ │
│  │    if !batches[batchId]  → Unknown                                      │ │
│  │    if revocations[leaf]  → Revoked (+ reason + date)                   │ │
│  │    if MerkleProof.verify → Valid                                        │ │
│  │    else                  → Tampered                                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Monorepo structure

```
veridoc/
├── packages/core/          # Isomorphic: hashFile, buildBatchTree, leafHash, bundles
├── packages/contracts/     # VeriDoc.sol — Hardhat + OpenZeppelin v5
├── packages/cli/           # veridoc batch/anchor/revoke/inspect
├── apps/web/               # Next.js — verify (public) + issuer dashboard + demo
└── fixtures/               # 5 demo PDFs + manifest + 1 tampered copy
```

### Leaf encoding

Each document is encoded as a leaf in a `StandardMerkleTree`:

```
leaf = ['bytes32', 'string', 'bytes32'] = [sha256(file), certId, salt]
```

The tree uses double-hashing and sorted pairs (OpenZeppelin's standard). The double-hashed leaf value becomes the on-chain revocation key. The salt prevents brute-force preimage attacks on predictable certificate content.

### Verification states

| State | Meaning |
|-------|---------|
| `Valid` | Merkle proof is correct; leaf is not revoked |
| `Tampered` | Merkle proof does not verify against the anchored root |
| `Revoked` | Proof is valid but the leaf was explicitly revoked by the batch issuer |
| `Unknown` | This batch ID has never been anchored |

## Gas numbers (Phase 3 — measured on Hardhat local node)

| Operation | Gas used | Notes |
|-----------|----------|-------|
| `anchorBatch` (1-leaf tree) | **96,178** | Fixed cost: stores root + issuer + timestamp |
| `revokeMany` (50 leaves) | **2,462,647** | ~49,253 gas/leaf at scale |
| `verify()` | **0** | View function — no transaction, no wallet |

At 20 gwei on Ethereum mainnet: `anchorBatch` ≈ $0.50, `revokeMany` (50) ≈ $25. On L2s (Arbitrum, Base) costs are 10–100× lower.

## Local setup

```bash
# Prerequisites: Node 22+, pnpm 11+
git clone <repo>
cd veridoc
cp .env.example .env
# Fill in SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, ETHERSCAN_API_KEY, etc.

pnpm install
pnpm -r build

# 1. Start local Hardhat node
cd packages/contracts && pnpm exec hardhat node

# 2. Deploy locally (in a new terminal)
cd packages/contracts && pnpm deploy:local

# 3. Copy the deployed address into apps/web/.env.local
cp apps/web/.env.local.example apps/web/.env.local
# Edit NEXT_PUBLIC_CONTRACT_ADDRESS to the deployed address
# NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
# NEXT_PUBLIC_CHAIN_ID=31337

# 4. Generate demo certificates
node packages/cli/dist/generate-fixtures.js fixtures

# 5. Batch and anchor the fixtures
pnpm exec --filter @veridoc/cli -- veridoc batch \
  --input fixtures --manifest fixtures/manifest.csv \
  --out out/demo-batch --issuer-name "Acme University" \
  --web-url http://localhost:3000

pnpm exec --filter @veridoc/cli -- veridoc anchor \
  --batch out/demo-batch --network localhost

# 6. Run the web app
cd apps/web && pnpm dev
```

> **Set `--web-url` up front.** The QR codes embed `<web-url>/v/<batchId>/<certId>#s=<salt>`
> at batch-generation time. Point it at the URL verifiers will actually use (e.g. your
> deployed frontend) before running `batch` — not after. `batch` draws a fresh random
> salt for every certificate on each run, so re-running it to fix the URL changes every
> leaf and the Merkle root, invalidating any bundles already issued and any root already
> anchored on-chain (`anchorBatch` rejects a duplicate `batchId`). If only the QR
> destination needs to change for an already-anchored batch, use
> `packages/cli/scripts/regenerate-qr.mjs` instead, which re-renders QR codes from the
> existing bundles without touching salts, hashes, or proofs.

## Running tests

```bash
# All packages
pnpm -r test

# Individual
pnpm --filter @veridoc/core test       # 26 unit tests
pnpm --filter @veridoc/contracts test  # 14 Hardhat tests (gas snapshot included)
pnpm --filter @veridoc/cli test        # 3 e2e tests (requires local node)
```

## Deployed contracts

| Field | Value |
|-------|-------|
| Network | Sepolia (chainId `11155111`) |
| Contract | [`0xC6fDC47425E4EC40Bfe32e08254b41b68B9DfFF2`](https://sepolia.etherscan.io/address/0xC6fDC47425E4EC40Bfe32e08254b41b68B9DfFF2) |
| Admin / issuer | [`0x4E568fB6aFa31b87c4fb978566dA63471c0cA48A`](https://sepolia.etherscan.io/address/0x4E568fB6aFa31b87c4fb978566dA63471c0cA48A) ("IIUC") |
| `registerIssuer` tx | [`0xd4d64a8ad0...806a11`](https://sepolia.etherscan.io/tx/0xd4d64a8ad00ef9c9ff31082fe329a12e5de6f28de3680c582971e02b59806a11) (block 11391431) |
| `anchorBatch` tx | [`0x7c8bd966cd...d4e5c7b`](https://sepolia.etherscan.io/tx/0x7c8bd966cd65d333d17ad3d6d7bb597cc1dfba7decb6bc857d97931afd4e5c7b) (block 11391437) |
| Anchored batch | `demo-2024` |
| Merkle root | `0xcc9f96f8d96ac9bc2314a336d1945f47022d350f9ff6760ad9601b9cfca76375` |
| Live frontend | [https://veridoc-web-nu.vercel.app/](https://veridoc-web-nu.vercel.app/) |

## Try it

Verify a real credential against the live Sepolia deployment, no wallet or install required:

1. Open [https://veridoc-web-nu.vercel.app/](https://veridoc-web-nu.vercel.app/).
2. Upload `fixtures/CERT-2024-001.pdf` as the document.
3. Upload `out/batches/demo/bundle-CERT-2024-001.json` as the credential bundle.
4. Expect **Valid** — the file matches the hash anchored in batch `demo-2024`.
5. Repeat with `fixtures/CERT-2024-001-TAMPERED.pdf` in place of the original PDF (same bundle).
6. Expect **Tampered** — the file's hash no longer matches the anchored leaf.

## Vercel deployment

`apps/web` deploys to Vercel as a standalone project:

- **Root Directory**: `apps/web`
- **Build command**: read from `apps/web/vercel.json` (`pnpm --filter @veridoc/core build && pnpm build`) — this builds `@veridoc/core`'s `dist/` output before `next build`, since Vercel only installs and builds within the Root Directory by default and `apps/web` depends on the compiled core package.

Required environment variables (Project Settings → Environment Variables):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_RPC_URL` | Sepolia RPC endpoint |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed `VeriDoc.sol` address |
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` (Sepolia) |

> **Warning**: `NEXT_PUBLIC_RPC_URL` is inlined into client-side JS and visible to anyone using the site — use an RPC provider key that is domain-restricted, not a general-purpose key.

## Known limitations

1. **PDF byte-instability**: Re-saving, re-printing, or digitally signing a PDF changes its bytes and therefore its SHA-256 hash. Holders must submit the exact file they received — not a re-exported copy.

2. **Salt distribution**: The salt lives in the credential bundle (QR code or JSON). Losing the bundle means losing the ability to verify. The salt is not recoverable from on-chain data. Issuers should advise holders to store the bundle alongside the certificate.

3. **Testnet only**: VeriDoc targets Sepolia. Production use requires a smart contract audit, a choice of production network (L1 or L2), and an ISSUER_ROLE key management procedure.

4. **Issuer address as trust anchor**: The `issuerName` display name is set by the admin. Verifiers should confirm the issuer's Ethereum address, not just the name.

5. **Revocation is batch-scoped by caller, not by leaf**: `revoke()` checks that the caller is the issuer of the `batchId` passed in, but never verifies that the leaf actually belongs to that batch — `_revocations` is keyed globally by leaf. An issuer could therefore revoke a credential from another issuer's batch by passing their own `batchId`. Fixing this requires either taking a Merkle proof in `revoke()` or keying revocations by `keccak256(batchId, leaf)`. Not exploitable in the current single-issuer deployment.

6. **CLI's Tampered result is not always chain-derived**: `veridoc inspect` short-circuits to `Tampered` on a local file-hash mismatch before ever querying the chain, so that result comes from a local comparison, not the contract. The web app has no such short-circuit — its verdict always comes from `verify()` on-chain.

## Phases

- [x] Phase 1 — Monorepo scaffold
- [x] Phase 2 — `packages/core`
- [x] Phase 3 — `packages/contracts`
- [x] Phase 4 — `packages/cli`
- [x] Phase 5 — `apps/web`
- [x] Phase 6 — Deploy to Sepolia + Vercel
