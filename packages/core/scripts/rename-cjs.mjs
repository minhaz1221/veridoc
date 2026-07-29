// Write a package.json into dist/cjs/ that marks those files as CommonJS.
// This way *.js in dist/esm/ is ESM (parent "type":"module") and
// *.js in dist/cjs/ is CJS (local override).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cjsDir = join(__dirname, '../dist/cjs');

mkdirSync(cjsDir, { recursive: true });
writeFileSync(join(cjsDir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
console.log('Wrote dist/cjs/package.json (type: commonjs)');
