// First-run setup: registers the bundled sample models, approves them and
// schedules two weeks of puzzles (a few in the past so the archive has content).
// Safe to re-run: it never touches models you added or dates already scheduled.
// Run: npm run seed
import { scanLibrary } from '../src/lib/ingest';
import { listAssets, updateAsset } from '../src/lib/assets';
import { addDays, db, today } from '../src/lib/db';

const ORDER = ['key-switch', 'fan-stage', 'measuring-tool', 'igniter', 'front-wing', 'glass-valve', 'valve-shaft',
  'deep-space-probe', 'reciprocating-part', 'light-control', 'cabinet-control', 'rolling-element',
  'twisted-ladder', 'spinning-instrument', 'gear-train'];
const PAST_DAYS = 4;

async function main() {
  const report = await scanLibrary();
  console.log(`Scanned library: ${report.added.length} new, ${report.total} total, ${report.errors.length} errors`);
  for (const e of report.errors) console.log(`  ! ${e.file}: ${e.error}`);

  const samples = listAssets().filter((a) => a.meta.sourceSite === 'Shadowplay sample library');
  for (const a of samples) {
    if (a.status === 'review' && a.missing.length === 0) updateAsset(a.id, { status: 'approved' });
  }

  const start = addDays(today(), -PAST_DAYS);
  const insert = db().prepare("INSERT OR IGNORE INTO schedule (date, asset_id, status) VALUES (?, ?, 'scheduled')");
  let scheduled = 0;
  ORDER.forEach((name, i) => {
    const asset = samples.find((a) => a.file.endsWith(`/${name}.glb`));
    if (!asset || asset.scheduled.length) return;
    scheduled += Number(insert.run(addDays(start, i), asset.id).changes);
  });
  console.log(`Approved ${samples.length} sample models, scheduled ${scheduled} puzzles from ${start} (today is ${today()}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
