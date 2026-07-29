# Security Model

## Trust assumptions

### What the smart contract guarantees

The Ethereum blockchain provides the following guarantees that no server-side
system can match:

1. **Append-only**: Once a Merkle root is written to `_batches[batchId]`,
   no function in the contract can overwrite or delete it. The `anchorBatch`
   function explicitly reverts if the batchId already exists
   (`BatchAlreadyExists`).

2. **Un-backdatable**: The `issuedAt` field is set to `block.timestamp` at
   the moment of anchoring. Block timestamps are set by miners/validators and
   cannot be changed retroactively.

3. **Public and permissionless**: Anyone with an Ethereum RPC endpoint can
   call `verify()` — a `view` function that costs no gas and requires no
   account. Verification is independent of the issuer's infrastructure.

### What a compromised issuer key can do

An attacker who compromises an ISSUER_ROLE private key can:

- Anchor new batches (associating arbitrary Merkle roots with new batch IDs)
- Revoke legitimate credentials from batches they anchored
- Do **not** have the ability to un-anchor existing batches (they are immutable)
- Do **not** have the ability to unrevoke credentials (revocation is also
  append-only)
- Do **not** have the ability to anchor batches using a different issuer
  address (the contract stores `msg.sender` as the batch issuer and only
  allows that address to revoke from that batch)

**Mitigation**: Issuers should use hardware wallets, multisig, or MPC
setups for ISSUER_ROLE keys. The `DEFAULT_ADMIN_ROLE` (which can grant new
issuers) should use a separate key, ideally a multisig.

### What a compromised DEFAULT_ADMIN_ROLE can do

An attacker with the admin key can:

- Grant ISSUER_ROLE to arbitrary addresses
- They **cannot** remove existing batch records (immutable) or unrevoke
  credentials

The admin key is the highest-privilege key in the system. It should be a
multisig or hardware wallet with a high threshold.

### Why revocation is not deletion

Immutability is a feature, not a limitation. If the contract allowed
deleting revocation records:

1. An attacker who compromised the issuer key could first revoke a
   credential, then delete the revocation to cover their tracks.
2. A verifier relying on a cached response would see "Valid" for a
   recently-revoked credential.

The append-only revocation model means that once a credential is revoked,
that fact is permanent and publicly auditable. Verifiers who cached an
earlier "Valid" response can always re-query to discover the revocation.

### Why the salt is not on-chain

Certificate content is predictable: name, program, CGPA, date. A leaf
without a salt is `sha256(fileSha256 || certId)` which can be precomputed
for any plausible certificate. An adversary could enumerate all reasonable
CGPA values and certIds to discover whether a specific person graduated
with a specific grade.

The salt is a 32-byte random value generated at batch time. It is stored in
the credential bundle (QR code / JSON file) — not in the contract. Without
the salt, a verifier cannot compute the leaf hash and therefore cannot
verify. This provides forward secrecy: knowing the Merkle root does not
reveal which individuals are in the batch.

**Consequence**: if a holder loses their credential bundle (QR + JSON), they
lose the ability to prove their credential. The issuer can reissue a new
credential in a new batch, but cannot recover the original salt.

### File hash stability

VeriDoc hashes the PDF bytes directly using SHA-256. PDF is a rich format
where operations like:
- Re-saving in a different PDF viewer
- Printing to PDF
- Signing with a digital signature
- Compressing or optimising

all produce different bytes, and therefore different hashes. Holders must
store and submit the exact file they received. If the original file is lost,
the issuer must reissue.

### Testnet-only caveat

The current deployment targets Sepolia testnet. Sepolia is a public
test network and should not be used for credentials that carry real-world
consequences. A mainnet deployment would require:

1. A formal smart contract audit
2. A decision on which L1/L2 best suits the cost and longevity requirements
3. A key management procedure for the ISSUER_ROLE and DEFAULT_ADMIN_ROLE keys
4. A long-term commitment to maintaining the RPC infrastructure used by the
   frontend

### What the verifier must trust

- **The Ethereum network consensus**: The verifier trusts that the
  transaction history of the network is honest. This is the base layer of
  trust — equivalent to trusting DNS for a web certificate.
- **The specific contract address**: The verifier must know they are
  querying the correct contract. This is provided in the credential bundle
  and displayed in the UI.
- **The issuer's display name**: The `_issuerNames` mapping is set by the
  DEFAULT_ADMIN_ROLE. A compromised admin could register a malicious address
  under a legitimate-sounding name. The issuer's Ethereum address is always
  shown alongside the display name.
- **The frontend does NOT read file bytes**: The verify page uses
  `crypto.subtle.digest` client-side. No server ever receives the document.
