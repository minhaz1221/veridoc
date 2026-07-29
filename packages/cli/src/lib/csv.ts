import { readFileSync } from 'node:fs';

export type ManifestRow = {
  filename: string;
  certId: string;
  recipientName: string;
  program: string;
  issuedOn: string;
};

export function parseManifest(csvPath: string): ManifestRow[] {
  const text = readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const [header, ...rows] = lines;
  if (!header) throw new Error('Manifest CSV is empty');

  const cols = header.split(',').map((c) => c.trim());
  const required = ['filename', 'certId', 'recipientName', 'program', 'issuedOn'];
  for (const col of required) {
    if (!cols.includes(col)) throw new Error(`Manifest CSV missing column: ${col}`);
  }

  return rows.map((row, i) => {
    const vals = row.split(',');
    const get = (col: string): string => {
      const idx = cols.indexOf(col);
      const val = vals[idx]?.trim();
      if (!val) throw new Error(`Row ${i + 2}: missing value for column "${col}"`);
      return val;
    };
    return {
      filename: get('filename'),
      certId: get('certId'),
      recipientName: get('recipientName'),
      program: get('program'),
      issuedOn: get('issuedOn'),
    };
  });
}
