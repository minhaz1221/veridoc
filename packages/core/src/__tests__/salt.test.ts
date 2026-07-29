import { describe, it, expect } from 'vitest';
import { generateSalt } from '../salt.js';

describe('generateSalt', () => {
  it('returns a 0x-prefixed 66-char hex string', () => {
    const salt = generateSalt();
    expect(salt).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it('returns unique salts across 10,000 draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const salt = generateSalt();
      expect(seen.has(salt)).toBe(false);
      seen.add(salt);
    }
    expect(seen.size).toBe(10_000);
  });

  it('returns 32 bytes of entropy (64 hex chars after 0x)', () => {
    const salt = generateSalt();
    const hex = salt.slice(2);
    expect(hex).toHaveLength(64);
  });
});
