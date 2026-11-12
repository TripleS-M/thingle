// Scan the asset library and register any new models (in "review" state).
// Run: npm run scan
import { scanLibrary } from '../src/lib/ingest';

async function main() {
  const report = await scanLibrary();
  for (const a of report.added) console.log(`  + registered ${a.file}  (id ${a.id}, awaiting review)`);
  for (const d of report.duplicates) console.log(`  = duplicate  ${d.file}  (same file as ${d.duplicateOf}) — skipped`);
  for (const e of report.errors) console.log(`  ! failed     ${e.file}: ${e.error}`);
  console.log(`\n${report.total} assets registered · ${report.added.length} new · ${report.duplicates.length} duplicates · ${report.moved} moved · ${report.missing} missing files · ${report.errors.length} errors`);
}

main().catch((e) => { console.error(e); process.exit(1); });
