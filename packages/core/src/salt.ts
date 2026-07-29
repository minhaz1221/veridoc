import type { Hex } from './types.js';

function bytesToHex(bytes: Uint8Array): Hex {
  let hex = '0x';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex as Hex;
}

export function generateSalt(): Hex {
  const bytes = new Uint8Array(32);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues !== 'undefined') {
    globalThis.crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  // Node.js path (synchronous fallback for environments without Web Crypto)
  // Using dynamic require is not valid in ESM; this branch is only reached in
  // very old Node environments that predate crypto.getRandomValues support.
  // Node 15+ exposes crypto.getRandomValues globally, so this branch is unreachable
  // in our minimum Node 22 requirement.
  throw new Error('crypto.getRandomValues is not available in this environment');
}
