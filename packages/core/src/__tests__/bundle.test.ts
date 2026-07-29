import { describe, it, expect } from 'vitest';
import { encodeBundle, decodeBundle } from '../bundle.js';
import type { CredentialBundle } from '../types.js';

const VALID_BUNDLE: CredentialBundle = {
  version: 1,
  batchId: 'batch-2024-01',
  certId: 'cert-001',
  salt: `0x${'aa'.repeat(32)}` as `0x${string}`,
  fileSha256: `0x${'bb'.repeat(32)}` as `0x${string}`,
  proof: [`0x${'cc'.repeat(32)}` as `0x${string}`],
  contractAddress: `0x${'dd'.repeat(20)}` as `0x${string}`,
  chainId: 11155111,
  issuerName: 'Test University',
};

describe('encodeBundle / decodeBundle', () => {
  it('round-trips a valid bundle', () => {
    const json = encodeBundle(VALID_BUNDLE);
    const decoded = decodeBundle(json);
    expect(decoded).toEqual(VALID_BUNDLE);
  });

  it('throws on invalid JSON', () => {
    expect(() => decodeBundle('not json')).toThrow(/Invalid JSON/);
  });

  it('throws when version is missing', () => {
    const { version: _v, ...rest } = VALID_BUNDLE;
    expect(() => decodeBundle(JSON.stringify(rest))).toThrow();
  });

  it('throws when version is not 1', () => {
    expect(() =>
      decodeBundle(JSON.stringify({ ...VALID_BUNDLE, version: 2 })),
    ).toThrow();
  });

  it('throws when salt is not hex', () => {
    expect(() =>
      decodeBundle(JSON.stringify({ ...VALID_BUNDLE, salt: 'not-hex' })),
    ).toThrow();
  });

  it('throws when proof contains non-hex values', () => {
    expect(() =>
      decodeBundle(JSON.stringify({ ...VALID_BUNDLE, proof: ['invalid'] })),
    ).toThrow();
  });

  it('throws when chainId is not a positive integer', () => {
    expect(() =>
      decodeBundle(JSON.stringify({ ...VALID_BUNDLE, chainId: -1 })),
    ).toThrow();
  });

  it('encodes as pretty-printed JSON', () => {
    const json = encodeBundle(VALID_BUNDLE);
    expect(json).toContain('\n');
  });
});
