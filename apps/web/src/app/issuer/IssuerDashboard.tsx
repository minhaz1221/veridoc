'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getContractAddress, getChainId } from '../../lib/contract';

const VERIDOC_ABI = [
  'function anchorBatch(bytes32 batchId, bytes32 root, string calldata metaURI)',
  'function revoke(bytes32 batchId, bytes32 leaf, string calldata reason)',
  'function registerIssuer(address issuer, string calldata name)',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function ISSUER_ROLE() external view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() external view returns (bytes32)',
  'event BatchAnchored(bytes32 indexed batchId, bytes32 root, address indexed issuer, uint64 issuedAt, string metaURI)',
];

type WalletState =
  | { status: 'disconnected' }
  | { status: 'wrong-chain'; chainId: number }
  | { status: 'not-issuer'; address: string }
  | { status: 'ready'; address: string; isAdmin: boolean; signer: ethers.JsonRpcSigner; contract: ethers.Contract };

type TxState = 'idle' | 'pending' | 'success' | 'error';

export function IssuerDashboard() {
  const [wallet, setWallet] = useState<WalletState>({ status: 'disconnected' });
  const [batchJson, setBatchJson] = useState<string>('');
  const [revokeLeaf, setRevokeLeaf] = useState('');
  const [revokeBatchId, setRevokeBatchId] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [txState, setTxState] = useState<TxState>('idle');
  const [txMsg, setTxMsg] = useState('');
  const [adminIssuerAddr, setAdminIssuerAddr] = useState('');
  const [adminIssuerName, setAdminIssuerName] = useState('');

  const expectedChainId = getChainId();
  const contractAddress = getContractAddress();

  async function connect() {
    if (!window.ethereum) {
      alert('MetaMask is required to use the issuer dashboard.');
      return;
    }
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    await checkWallet();
  }

  async function checkWallet() {
    if (!window.ethereum) return;
    const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId !== expectedChainId) {
      setWallet({ status: 'wrong-chain', chainId });
      return;
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const contract = new ethers.Contract(contractAddress, VERIDOC_ABI, provider);

    const issuerRole = await (contract['ISSUER_ROLE'] as () => Promise<string>)();
    const adminRole = await (contract['DEFAULT_ADMIN_ROLE'] as () => Promise<string>)();
    const isIssuer = await (contract['hasRole'] as (...a: unknown[]) => Promise<boolean>)(issuerRole, address);
    const isAdmin = await (contract['hasRole'] as (...a: unknown[]) => Promise<boolean>)(adminRole, address);

    if (!isIssuer) {
      setWallet({ status: 'not-issuer', address });
      return;
    }

    const writable = new ethers.Contract(contractAddress, VERIDOC_ABI, signer);
    setWallet({ status: 'ready', address, isAdmin, signer, contract: writable });
  }

  async function switchChain() {
    if (!window.ethereum) return;
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + expectedChainId.toString(16) }],
    });
    await checkWallet();
  }

  async function anchorBatch() {
    if (wallet.status !== 'ready') return;
    let parsed: { batchId: string; root: string; [k: string]: unknown };
    try {
      parsed = JSON.parse(batchJson) as typeof parsed;
    } catch {
      setTxMsg('Invalid batch JSON');
      setTxState('error');
      return;
    }

    setTxState('pending');
    setTxMsg('Sending anchorBatch...');
    try {
      const batchIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(parsed.batchId));
      const tx = await (wallet.contract['anchorBatch'] as (...a: unknown[]) => Promise<{ hash: string; wait: () => Promise<unknown> }>)(
        batchIdBytes32,
        parsed.root,
        `ipfs://${parsed.batchId}`,
      );
      setTxMsg(`Tx sent: ${tx.hash}`);
      await tx.wait();
      setTxMsg(`Anchored! Tx: ${tx.hash}`);
      setTxState('success');
    } catch (err) {
      setTxMsg(String(err));
      setTxState('error');
    }
  }

  async function revokeCredential() {
    if (wallet.status !== 'ready') return;
    setTxState('pending');
    setTxMsg('Sending revoke...');
    try {
      const batchIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(revokeBatchId));
      const tx = await (wallet.contract['revoke'] as (...a: unknown[]) => Promise<{ hash: string; wait: () => Promise<unknown> }>)(
        batchIdBytes32,
        revokeLeaf,
        revokeReason,
      );
      await tx.wait();
      setTxMsg(`Revoked! Tx: ${tx.hash}`);
      setTxState('success');
    } catch (err) {
      setTxMsg(String(err));
      setTxState('error');
    }
  }

  async function registerIssuer() {
    if (wallet.status !== 'ready' || !wallet.isAdmin) return;
    setTxState('pending');
    setTxMsg('Registering issuer...');
    try {
      const tx = await (wallet.contract['registerIssuer'] as (...a: unknown[]) => Promise<{ hash: string; wait: () => Promise<unknown> }>)(
        adminIssuerAddr,
        adminIssuerName,
      );
      await tx.wait();
      setTxMsg(`Registered! Tx: ${tx.hash}`);
      setTxState('success');
    } catch (err) {
      setTxMsg(String(err));
      setTxState('error');
    }
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <span className="site-name">VeriDoc</span>
        <nav>
          <a href="/">Verify</a>
          <a href="/demo">Demo</a>
        </nav>
      </header>

      <div className="page-content">
        <h1>Issuer Dashboard</h1>

        {wallet.status === 'disconnected' && (
          <div className="wallet-gate">
            <p>Connect your MetaMask wallet to access issuer functions.</p>
            <button onClick={connect} className="verify-button">Connect Wallet</button>
          </div>
        )}

        {wallet.status === 'wrong-chain' && (
          <div className="wallet-gate">
            <p>
              Connected to chain {wallet.chainId}. This app expects chain {expectedChainId} (
              {expectedChainId === 11155111 ? 'Sepolia' : expectedChainId === 31337 ? 'Hardhat' : 'unknown'}).
            </p>
            <button onClick={switchChain} className="verify-button">Switch Network</button>
          </div>
        )}

        {wallet.status === 'not-issuer' && (
          <div className="wallet-gate">
            <p>
              Address <code>{wallet.address}</code> does not have the ISSUER_ROLE on this
              contract. Contact the contract admin to be granted access.
            </p>
          </div>
        )}

        {wallet.status === 'ready' && (
          <div className="issuer-panel">
            <p className="issuer-address">
              Connected: <code>{wallet.address}</code>
              {wallet.isAdmin && <span className="badge">Admin</span>}
            </p>

            <section className="issuer-section">
              <h2>Anchor Batch</h2>
              <p>Paste the contents of <code>batch.json</code> produced by <code>veridoc batch</code>.</p>
              <textarea
                value={batchJson}
                onChange={(e) => setBatchJson(e.target.value)}
                rows={8}
                placeholder='{"batchId":"...","root":"0x...","leafCount":5,...}'
                aria-label="Batch JSON"
                className="code-textarea"
              />
              <button
                onClick={anchorBatch}
                disabled={txState === 'pending' || !batchJson}
                className="verify-button"
              >
                Anchor Batch
              </button>
            </section>

            <section className="issuer-section">
              <h2>Revoke Credential</h2>
              <label>
                Batch ID (human-readable string)
                <input
                  value={revokeBatchId}
                  onChange={(e) => setRevokeBatchId(e.target.value)}
                  placeholder="batch-2024-graduation"
                  className="text-input"
                />
              </label>
              <label>
                Leaf hash (<code>0x…</code>)
                <input
                  value={revokeLeaf}
                  onChange={(e) => setRevokeLeaf(e.target.value)}
                  placeholder="0x..."
                  className="text-input code"
                />
              </label>
              <label>
                Reason
                <input
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Academic misconduct"
                  className="text-input"
                />
              </label>
              <button
                onClick={revokeCredential}
                disabled={txState === 'pending' || !revokeLeaf || !revokeBatchId || !revokeReason}
                className="verify-button"
              >
                Revoke
              </button>
            </section>

            {wallet.isAdmin && (
              <section className="issuer-section">
                <h2>Register Issuer (Admin)</h2>
                <label>
                  Address
                  <input
                    value={adminIssuerAddr}
                    onChange={(e) => setAdminIssuerAddr(e.target.value)}
                    placeholder="0x..."
                    className="text-input code"
                  />
                </label>
                <label>
                  Display name
                  <input
                    value={adminIssuerName}
                    onChange={(e) => setAdminIssuerName(e.target.value)}
                    placeholder="Acme University"
                    className="text-input"
                  />
                </label>
                <button
                  onClick={registerIssuer}
                  disabled={txState === 'pending' || !adminIssuerAddr || !adminIssuerName}
                  className="verify-button"
                >
                  Register Issuer
                </button>
              </section>
            )}

            {txMsg && (
              <div
                role="status"
                aria-live="polite"
                className={`tx-status tx-status-${txState}`}
              >
                {txMsg}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
