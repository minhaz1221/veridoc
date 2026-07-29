import type { Hex } from './types.js';

function uint8ArrayToHex(bytes: Uint8Array<ArrayBuffer>): Hex {
  let hex = '0x';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex as Hex;
}

/** Copy into a fresh plain ArrayBuffer so crypto.subtle.digest accepts it. */
function toPlainBuffer(input: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const buf = new ArrayBuffer(src.byteLength);
  const out = new Uint8Array(buf);
  out.set(src);
  return out;
}

// Node.js 15+ and all modern browsers expose globalThis.crypto.subtle.
// Our minimum requirement is Node 22, so this path works everywhere.
export async function hashFile(input: ArrayBuffer | Uint8Array): Promise<Hex> {
  const bytes = toPlainBuffer(input);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return uint8ArrayToHex(new Uint8Array(hash) as Uint8Array<ArrayBuffer>);
}
