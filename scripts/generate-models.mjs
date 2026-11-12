// Generates the bundled sample models (original, procedurally built, CC0) into
// the asset library, each with a ".meta.json" sidecar that pre-fills metadata.
// Run: npm run models
import fs from 'node:fs';
import path from 'node:path';
import { writeGLB, CREDIT } from './models/lib.mjs';
import a from './models/catalog-a.mjs';
import b from './models/catalog-b.mjs';
import c from './models/catalog-c.mjs';

const LIB = path.join(process.cwd(), 'assets', 'shadowplay');
const only = process.argv[2];

for (const model of [...a, ...b, ...c]) {
  if (only && !model.file.includes(only)) continue;
  const out = path.join(LIB, `${model.file}.glb`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await writeGLB(model.build(), out);
  fs.writeFileSync(out.replace(/\.glb$/, '.meta.json'), JSON.stringify({ ...model.meta, ...CREDIT }, null, 2));
  console.log(`  wrote ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
