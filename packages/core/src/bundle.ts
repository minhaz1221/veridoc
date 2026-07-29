import { CredentialBundleSchema, type CredentialBundle } from './types.js';

export function encodeBundle(bundle: CredentialBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function decodeBundle(json: string): CredentialBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON in credential bundle');
  }
  const result = CredentialBundleSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid credential bundle: ${result.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  return result.data;
}
