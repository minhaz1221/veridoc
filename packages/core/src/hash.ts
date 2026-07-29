import type { Hex } from './types.js';

function uint8ArrayToHex(bytes: Uint8Array<ArrayBuffer>): Hex {
  let hex = '0x';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex as Hex;
}

/** Copy any typed array input into a fresh, plain ArrayBuffer so crypto APIs accept it. */
function toPlainBuffer(input: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const buf = new ArrayBuffer(src.byteLength);
  const out = new Uint8Array(buf);
  out.set(src);
  return out;
}

async function sha256Browser(bytes: Uint8Array<ArrayBuffer>): Promise<Hex> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return uint8ArrayToHex(new Uint8Array(hash) as Uint8Array<ArrayBuffer>);
}

async function sha256Node(bytes: Uint8Array<ArrayBuffer>): Promise<Hex> {
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(bytes).digest('hex');
  return `0x${hash}` as Hex;
}

export async function hashFile(input: ArrayBuffer | Uint8Array): Promise<Hex> {
  const bytes = toPlainBuffer(input);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined') {
    return sha256Browser(bytes);
  }
  return sha256Node(bytes);
}
