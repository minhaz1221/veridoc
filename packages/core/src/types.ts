import { z } from 'zod';

export type Hex = `0x${string}`;

export const HexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/).transform((s) => s as Hex);

export type CertificateLeaf = {
  fileSha256: Hex;
  certId: string;
  salt: Hex;
};

export const CertificateLeafSchema = z.object({
  fileSha256: HexSchema,
  certId: z.string().min(1),
  salt: HexSchema,
});

export const CredentialBundleSchema = z.object({
  version: z.literal(1),
  batchId: z.string().min(1),
  certId: z.string().min(1),
  salt: HexSchema,
  fileSha256: HexSchema,
  proof: z.array(HexSchema),
  contractAddress: HexSchema,
  chainId: z.number().int().positive(),
  issuerName: z.string().min(1),
});

export type CredentialBundle = z.infer<typeof CredentialBundleSchema>;
