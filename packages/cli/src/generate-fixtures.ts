#!/usr/bin/env node
/**
 * Generates demo certificate PDFs and a matching manifest CSV for testing.
 * Produces one deliberately tampered copy with a single CGPA digit changed.
 *
 * Run: node --import tsx/esm src/generate-fixtures.ts <outputDir>
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outputDir = process.argv[2] ?? '../../fixtures';

mkdirSync(outputDir, { recursive: true });

type CertData = {
  certId: string;
  recipientName: string;
  program: string;
  cgpa: string;
  issuedOn: string;
};

const certs: CertData[] = [
  { certId: 'CERT-2024-001', recipientName: 'Alice Johnson', program: 'Computer Science', cgpa: '3.9', issuedOn: '2024-06-15' },
  { certId: 'CERT-2024-002', recipientName: 'Bob Martinez', program: 'Electrical Engineering', cgpa: '3.7', issuedOn: '2024-06-15' },
  { certId: 'CERT-2024-003', recipientName: 'Carol Chen', program: 'Data Science', cgpa: '4.0', issuedOn: '2024-06-15' },
  { certId: 'CERT-2024-004', recipientName: 'David Kim', program: 'Cybersecurity', cgpa: '3.8', issuedOn: '2024-06-15' },
  { certId: 'CERT-2024-005', recipientName: 'Eva Patel', program: 'Software Engineering', cgpa: '3.6', issuedOn: '2024-06-15' },
];

async function makeCertPdf(cert: CertData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  // Border
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: rgb(0.1, 0.2, 0.5), borderWidth: 2 });

  // Title
  page.drawText('CERTIFICATE OF COMPLETION', { x: 100, y: height - 120, size: 22, font: bold, color: rgb(0.1, 0.2, 0.5) });

  // Issuer
  page.drawText('Acme University', { x: 210, y: height - 160, size: 14, font, color: rgb(0.3, 0.3, 0.3) });

  // Body
  page.drawText('This is to certify that', { x: 200, y: height - 250, size: 12, font });
  page.drawText(cert.recipientName, { x: 170, y: height - 290, size: 18, font: bold, color: rgb(0, 0, 0) });
  page.drawText('has successfully completed the program of', { x: 155, y: height - 330, size: 12, font });
  page.drawText(cert.program, { x: 200, y: height - 370, size: 14, font: bold });

  // CGPA — this is the field that gets tampered
  page.drawText(`CGPA: ${cert.cgpa} / 4.0`, { x: 220, y: height - 420, size: 13, font });
  page.drawText(`Issued on: ${cert.issuedOn}`, { x: 215, y: height - 460, size: 12, font });
  page.drawText(`Certificate ID: ${cert.certId}`, { x: 195, y: height - 500, size: 11, font, color: rgb(0.4, 0.4, 0.4) });

  // Footer
  page.drawText('This document has been digitally anchored on the Ethereum blockchain.', {
    x: 80, y: 80, size: 9, font, color: rgb(0.5, 0.5, 0.5),
  });

  return doc.save();
}

async function main() {
  const manifestRows: string[] = ['filename,certId,recipientName,program,issuedOn'];

  for (const cert of certs) {
    const pdf = await makeCertPdf(cert);
    const filename = `${cert.certId}.pdf`;
    writeFileSync(join(outputDir, filename), pdf);
    manifestRows.push(`${filename},${cert.certId},${cert.recipientName},${cert.program},${cert.issuedOn}`);
    console.log(`  Generated ${filename}`);
  }

  // Tampered copy: CERT-2024-001 with CGPA changed from 3.9 to 3.0
  const firstCert = certs[0]!;
  const tamperedCert: CertData = { ...firstCert, cgpa: '3.0' };
  const tamperedPdf = await makeCertPdf(tamperedCert);
  const tamperedFilename = `${firstCert.certId}-TAMPERED.pdf`;
  writeFileSync(join(outputDir, tamperedFilename), tamperedPdf);
  console.log(`  Generated ${tamperedFilename} (CGPA changed: 3.9 → 3.0)`);

  writeFileSync(join(outputDir, 'manifest.csv'), manifestRows.join('\n') + '\n');
  console.log(`\nManifest written to ${join(outputDir, 'manifest.csv')}`);
  console.log(`\nRun 'pnpm --filter @veridoc/cli exec veridoc batch --input ${outputDir} --manifest ${join(outputDir, 'manifest.csv')} --out out/demo-batch' to process.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
