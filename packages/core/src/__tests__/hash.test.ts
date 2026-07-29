import { describe, it, expect } from 'vitest';
import { hashFile } from '../hash.js';

// Known SHA-256 vectors
// echo -n "hello" | sha256sum → 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
const HELLO_SHA256 = '0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
const EMPTY_SHA256 = '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function toBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('hashFile', () => {
  it('produces the known SHA-256 of "hello"', async () => {
    const result = await hashFile(toBytes('hello'));
    expect(result).toBe(HELLO_SHA256);
  });

  it('produces the known SHA-256 of an empty input', async () => {
    const result = await hashFile(new Uint8Array(0));
    expect(result).toBe(EMPTY_SHA256);
  });

  it('accepts ArrayBuffer', async () => {
    const src = toBytes('hello');
    // Construct a guaranteed plain ArrayBuffer
    const buf = new ArrayBuffer(src.byteLength);
    new Uint8Array(buf).set(src);
    const result = await hashFile(buf);
    expect(result).toBe(HELLO_SHA256);
  });

  it('produces different hashes for different inputs', async () => {
    const a = await hashFile(toBytes('abc'));
    const b = await hashFile(toBytes('abd'));
    expect(a).not.toBe(b);
  });

  it('always starts with 0x', async () => {
    const result = await hashFile(toBytes('test'));
    expect(result.startsWith('0x')).toBe(true);
  });

  it('is 66 chars long (0x + 64 hex)', async () => {
    const result = await hashFile(toBytes('test'));
    expect(result).toHaveLength(66);
  });
});
