// End-to-end checks of the game rules, the asset pipeline and scheduling.
// Runs against a throw-away copy of the library and a temporary database, so
// it never touches your real data.   Run: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = process.cwd();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'shadowplay-test-'));
process.env.SHADOWPLAY_ROOT = TMP; // must be set before the libraries load
delete process.env.SHADOWPLAY_DB;

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? `  — ${detail}` : ''}`); }
}
function throws(fn: () => unknown, status?: number): boolean {
  try { fn(); return false; } catch (e) { return status === undefined || (e as { status?: number }).status === status; }
}

const CUBE_OBJ = `# unit cube
v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nv 0 0 1\nv 1 0 1\nv 1 1 1\nv 0 1 1
f 1 2 3 4\nf 5 8 7 6\nf 1 5 6 2\nf 2 6 7 3\nf 3 7 8 4\nf 5 1 4 8\n`;
const TETRA_STL = `solid t
facet normal 0 0 -1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet
facet normal 0 -1 0\nouter loop\nvertex 0 0 0\nvertex 0 0 1\nvertex 1 0 0\nendloop\nendfacet
facet normal -1 0 0\nouter loop\nvertex 0 0 0\nvertex 0 1 0\nvertex 0 0 1\nendloop\nendfacet
facet normal 1 1 1\nouter loop\nvertex 1 0 0\nvertex 0 0 1\nvertex 0 1 0\nendloop\nendfacet
endsolid t\n`;
function triangleGltf(): string {
  const buf = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => buf.writeFloatLE(v, i * 4));
  return JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36, uri: `data:application/octet-stream;base64,${buf.toString('base64')}` }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  });
}

async function main() {
  const { normaliseAnswer, isCorrect } = await import('../src/lib/answers');
  const { computeScore, shareText } = await import('../src/lib/scoring');
  const { db, PATHS, today, addDays, getSettings, saveSettings } = await import('../src/lib/db');
  const { scanLibrary, saveUpload, exposureAt } = await import('../src/lib/ingest');
  const { listAssets, getAsset, updateAsset, deleteAsset, modelPath } = await import('../src/lib/assets');
  const { setSchedule, clearSchedule, puzzleFor, isReleased } = await import('../src/lib/schedule');
  const { getState, submitGuess, useHint, resetPlay, playerStats, archive } = await import('../src/lib/game');
  const { loadModel } = await import('../src/lib/geometry');
  const { render } = await import('../src/lib/raster');
  const { DEFAULT_SETTINGS } = await import('../src/lib/types');

  // ── Answers ─────────────────────────────────────────────────────────────
  console.log('\nAnswer matching');
  check('normalises case, punctuation and spacing', normaliseAnswer('  The F1   Front-Wing!! ') === 'f1 front wing');
  check('primary answer accepted', isCorrect('f1 front wing', 'F1 Front Wing', []));
  check('alternative answer accepted', isCorrect('Formula 1 front wing.', 'F1 Front Wing', ['Formula 1 front wing']));
  check('spacing differences forgiven', isCorrect('cam shaft', 'Camshaft', []));
  check('no fuzzy matching: near misses rejected', !isCorrect('front wings', 'F1 Front Wing', ['Front wing']) && !isCorrect('wing', 'F1 Front Wing', ['Front wing']));
  check('empty guess rejected', !isCorrect('  ?! ', 'Camshaft', []));

  // ── Scoring ─────────────────────────────────────────────────────────────
  console.log('\nScoring');
  const S = DEFAULT_SETTINGS.scoring;
  check('500 / 400 / 300 / 200 / 100 by guess', [1, 2, 3, 4, 5].map((n) => computeScore(S, 'won', n, [])).join() === '500,400,300,200,100');
  check('failure scores 0', computeScore(S, 'lost', 5, []) === 0);
  check('hint deductions: guess 2 with category + rotation = 250', computeScore(S, 'won', 2, ['category', 'rotation']) === 250);
  check('never below zero', computeScore(S, 'won', 5, ['category', 'function', 'rotation']) === 0);

  // ── Timezone ────────────────────────────────────────────────────────────
  console.log('\nDaily changeover');
  check('default timezone is Australia/Melbourne', getSettings().timezone === 'Australia/Melbourne');
  check('date follows the game timezone, not UTC', today('Australia/Melbourne', new Date('2026-01-01T13:30:00Z')) === '2026-01-02'
    && today('America/Los_Angeles', new Date('2026-01-01T03:00:00Z')) === '2025-12-31');

  // ── Ingestion ───────────────────────────────────────────────────────────
  console.log('\nAsset ingestion');
  fs.mkdirSync(PATHS.library, { recursive: true });
  const copy = (rel: string) => {
    const to = path.join(PATHS.library, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(REPO, 'assets', 'shadowplay', rel), to);
  };
  for (const f of ['motorsport/front-wing', 'automotive/valve-shaft', 'automotive/igniter', 'electronics/glass-valve']) {
    copy(`${f}.glb`); copy(`${f}.meta.json`);
  }
  fs.mkdirSync(path.join(PATHS.library, 'random'), { recursive: true });
  fs.writeFileSync(path.join(PATHS.library, 'random', 'cube.obj'), CUBE_OBJ);
  fs.writeFileSync(path.join(PATHS.library, 'random', 'tetra.stl'), TETRA_STL);
  fs.writeFileSync(path.join(PATHS.library, 'random', 'triangle.gltf'), triangleGltf());
  fs.writeFileSync(path.join(PATHS.library, 'random', 'broken.glb'), 'this is not a model');
  fs.copyFileSync(path.join(PATHS.library, 'automotive', 'igniter.glb'), path.join(PATHS.library, 'random', 'copy-of-igniter.glb'));

  const first = await scanLibrary();
  check('new models detected (GLB, GLTF, OBJ, STL)', first.added.length === 7, `${first.added.length} added: ${first.added.map((a) => a.file).join(', ')}`);
  check('invalid file reported, not registered', first.errors.length === 1 && first.errors[0].file === 'random/broken.glb', JSON.stringify(first.errors));
  check('duplicate file detected by content', first.duplicates.length === 1 && first.duplicates[0].file.includes('igniter'), JSON.stringify(first.duplicates));
  const assets = listAssets();
  check('every new model enters review (never auto-published)', assets.length === 7 && assets.every((a) => a.status === 'review'));
  check('nothing is scheduled by ingestion', (db().prepare('SELECT COUNT(*) AS n FROM schedule').get() as { n: number }).n === 0);
  check('unique 12-character asset ids', new Set(assets.map((a) => a.id)).size === 7 && assets.every((a) => /^[0-9a-f]{12}$/.test(a.id)));
  check('geometry and dimensions read', assets.every((a) => a.stats.triangles > 0 && a.stats.size.length === 3 && a.stats.bytes > 0));
  check('thumbnail and four silhouette previews generated', assets.every((a) => fs.existsSync(path.join(PATHS.thumbnails, `${a.id}.png`))
    && [0, 1, 2, 3].every((i) => fs.existsSync(path.join(PATHS.previews, `${a.id}-${i}.png`)))));
  const wing = assets.find((a) => a.file === 'motorsport/front-wing.glb')!;
  const cube = assets.find((a) => a.file === 'random/cube.obj')!;
  check('sidecar .meta.json pre-fills metadata', wing.meta.answer === 'F1 Front Wing' && wing.meta.licence === 'CC0 1.0' && wing.missing.length === 0);
  check('category taken from the folder name', wing.meta.category === 'Motorsport');
  check('model without metadata is flagged "requires configuration"', cube.missing.includes('correct answer') && cube.missing.includes('licence'));
  check('OBJ / STL / GLTF converted to GLB for the viewer', assets.filter((a) => a.format !== 'glb').every((a) => fs.existsSync(modelPath(a))));
  const again = await scanLibrary();
  check('re-scan adds nothing', again.added.length === 0 && again.total === 7);
  check('upload refuses unsupported formats', throws(() => saveUpload('model.fbx', 'random', Buffer.from('x'))));
  fs.renameSync(path.join(PATHS.library, 'random', 'tetra.stl'), path.join(PATHS.library, 'random', 'pyramid.stl'));
  const moved = await scanLibrary();
  check('renamed file is re-linked, not re-registered', moved.moved === 1 && moved.added.length === 0 && moved.total === 7);

  // ── Silhouette rendering ────────────────────────────────────────────────
  console.log('\nSilhouette rendering');
  const { geo } = await loadModel(modelPath(wing));
  const img = render(geo, { pose: wing.meta.camera, size: 200, mode: 'silhouette', supersample: 1, background: [233, 227, 211] });
  let black = 0, bg = 0, other = 0;
  for (let i = 0; i < img.rgba.length; i += 4) {
    const [r, g, b] = [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]];
    if (r === 0 && g === 0 && b === 0) black++; else if (r === 233 && g === 227 && b === 211) bg++; else other++;
  }
  check('silhouette is pure black on the backdrop (no colour, no shading)', black > 500 && other === 0, `${black} black, ${bg} backdrop, ${other} other`);
  check('object is centred with margin (never fills the frame)', img.coverage > 0.02 && img.coverage < 0.7, `coverage ${img.coverage.toFixed(3)}`);
  const ex = await exposureAt(wing, wing.meta.camera);
  check('angle "exposure" measured between 0 and 1', ex.exposure >= 0 && ex.exposure <= 1);

  // ── Review & scheduling ─────────────────────────────────────────────────
  console.log('\nReview and scheduling');
  const now = today(), yesterday = addDays(now, -1), tomorrow = addDays(now, 1);
  check('unconfigured model cannot be approved', throws(() => updateAsset(cube.id, { status: 'approved' })));
  check('unapproved model cannot be scheduled', throws(() => setSchedule(tomorrow, wing.id, 'scheduled')));
  check('no puzzle today -> fallback state (null)', getState('p1', 'daily', null, false) === null);
  const cam = assets.find((a) => a.file === 'automotive/valve-shaft.glb')!;
  const plug = assets.find((a) => a.file === 'automotive/igniter.glb')!;
  const tube = assets.find((a) => a.file === 'electronics/glass-valve.glb')!;
  for (const a of [wing, cam, plug, tube]) updateAsset(a.id, { status: 'approved' });
  check('approving does not publish anything', puzzleFor(now) === null && !isReleased(wing.id));
  setSchedule(now, wing.id, 'draft');
  check('draft is not shown to players', getState('p1', 'daily', null, false) === null);
  setSchedule(now, wing.id, 'scheduled');
  setSchedule(tomorrow, cam.id, 'scheduled');
  setSchedule(addDays(now, 21), tube.id, 'scheduled');
  check('puzzles can be scheduled weeks ahead', puzzleFor(addDays(now, 21))?.asset.id === tube.id);
  db().prepare("INSERT INTO schedule (date, asset_id, status) VALUES (?, ?, 'scheduled')").run(yesterday, plug.id); // history
  check('past days cannot be rescheduled or cleared', throws(() => setSchedule(yesterday, cam.id, 'scheduled')) && throws(() => clearSchedule(yesterday)));
  check('released model may be served; future model may not', isReleased(wing.id) && isReleased(plug.id) && !isReleased(cam.id));

  // ── Game rules ──────────────────────────────────────────────────────────
  console.log('\nGame rules');
  const s0 = getState('p1', 'daily', null, false)!;
  check('same daily puzzle for every player', getState('p2', 'daily', null, false)!.model === s0.model && s0.date === now);
  const leak = JSON.stringify(s0).toLowerCase();
  check('state sent to the browser hides the answer, name, file and hints',
    s0.result === null && s0.hints.category === null && s0.hints.function === null
    && !leak.includes('wing') && !leak.includes('motorsport') && !leak.includes('aerodynamic'));
  check('model URL is an opaque id', /^\/api\/model\/[0-9a-f]{12}$/.test(s0.model));
  check('future puzzle refused (practice)', throws(() => getState('p1', 'practice', tomorrow, false), 403));
  check('today refused in practice mode', throws(() => getState('p1', 'practice', now, false), 403));
  check('preview mode refused without admin', throws(() => getState('p1', 'preview', tomorrow, false), 401));
  check('development mode: admin can test an upcoming day', getState('admin', 'preview', tomorrow, true)?.model === `/api/model/${cam.id}`);
  check('stale daily key rejected (tab left open past midnight)', throws(() => submitGuess('p1', 'daily', yesterday, 'x', false), 409));

  const g1 = submitGuess('p1', 'daily', null, 'A Spoon', false);
  check('wrong guess: neutral feedback, no reveal', !g1.correct && g1.message === 'Not quite. Take another look.' && g1.state.result === null);
  check('wrong guess leaves camera and rotation untouched', JSON.stringify(g1.state.camera) === JSON.stringify(s0.camera) && !g1.state.hints.rotation);
  check('repeated guess is rejected without cost', throws(() => submitGuess('p1', 'daily', null, 'a spoon!', false)) && getState('p1', 'daily', null, false)!.guesses.length === 1);
  check('blank guess rejected', throws(() => submitGuess('p1', 'daily', null, '   ', false)));
  const h1 = useHint('p1', 'daily', null, 'category', false);
  check('category hint reveals the category only', h1.hints.category === 'Motorsport' && h1.hints.function === null && !h1.hints.rotation);
  check('hints do not consume guesses', h1.guesses.length === 1);
  useHint('p1', 'daily', null, 'category', false);
  const h3 = useHint('p1', 'daily', null, 'rotation', false);
  check('rotation hint unlocks the configured allowance', h3.hints.rotation && h3.rotation.h === 30 && h3.rotation.v === 15);
  check('refresh keeps guesses and hints', (() => { const r = getState('p1', 'daily', null, false)!; return r.guesses.length === 1 && r.hints.rotation && r.hints.category === 'Motorsport'; })());
  const win = submitGuess('p1', 'daily', null, 'formula one front-wing', false);
  check('alternative answer wins', win.correct && win.state.status === 'won');
  check('score: 2nd guess (400) − category (50) − rotation (100) = 250, each hint charged once', win.state.result?.score === 250, String(win.state.result?.score));
  check('answer and description revealed after completion', win.state.result?.answer === 'F1 Front Wing' && !!win.state.result?.description);
  check('share text never names the object', !/wing|motorsport|f1/i.test(win.state.result!.share) && win.state.result!.share.includes('⬛🟩'));
  check('no more guesses or hints after the game ends', throws(() => submitGuess('p1', 'daily', null, 'x', false)) && throws(() => useHint('p1', 'daily', null, 'function', false)));
  check('daily game cannot be reset', throws(() => resetPlay('p1', 'daily', now), 403));

  for (let i = 1; i <= 4; i++) submitGuess('p2', 'daily', null, `wrong ${i}`, false);
  check('still playing after four wrong guesses', getState('p2', 'daily', null, false)!.status === 'playing');
  const lost = submitGuess('p2', 'daily', null, 'wrong 5', false);
  check('fifth wrong guess ends the game and reveals the answer', lost.state.status === 'lost' && lost.state.result?.answer === 'F1 Front Wing' && lost.state.result.score === 0);
  check('a sixth guess is impossible', throws(() => submitGuess('p2', 'daily', null, 'F1 front wing', false)));
  const perfect = submitGuess('p3', 'daily', null, 'F1 Front Wing', false);
  check('first-guess solve with no hints scores 500', perfect.state.result?.score === 500);

  // ── Practice & statistics ───────────────────────────────────────────────
  console.log('\nPractice and statistics');
  const st = playerStats('p1');
  check('daily win recorded in statistics', st.played === 1 && st.won === 1 && st.winPct === 100 && st.currentStreak === 1 && st.avgScore === 250 && st.totalHints === 2);
  const pr = submitGuess('p1', 'practice', yesterday, 'spark plug', false);
  check('older puzzles are playable in practice mode', pr.correct);
  check('practice does not affect daily statistics', playerStats('p1').played === 1 && playerStats('p1').avgScore === 250);
  check('archive lists released puzzles only', archive('p1').length === 1 && archive('p1')[0].date === yesterday);
  resetPlay('p1', 'practice', yesterday);
  check('practice can be replayed', getState('p1', 'practice', yesterday, false)!.guesses.length === 0);
  check('loss recorded: streak 0', playerStats('p2').currentStreak === 0 && playerStats('p2').won === 0 && playerStats('p2').played === 1);

  // ── Configurable rules ──────────────────────────────────────────────────
  console.log('\nConfiguration');
  saveSettings({ timezone: 'Australia/Melbourne', scoring: { guessPoints: [1000, 800, 600, 400, 200], hintCosts: { category: 10, function: 20, rotation: 30 } } });
  useHint('p4', 'daily', null, 'function', false);
  check('scoring and hint costs are configurable', submitGuess('p4', 'daily', null, 'front wing', false).state.result?.score === 980);
  saveSettings(DEFAULT_SETTINGS);
  updateAsset(cam.id, { meta: { rotation: { h: 45, v: 10 }, camera: { az: 500, el: 120, roll: 0, zoom: 9 }, background: '#101010' } });
  const edited = getAsset(cam.id)!;
  check('rotation allowance is configurable per puzzle', edited.meta.rotation.h === 45 && edited.meta.rotation.v === 10);
  check('camera values are clamped to safe ranges', edited.meta.camera.el === 89 && edited.meta.camera.zoom === 3 && Math.abs(edited.meta.camera.az) <= 180);
  check('dark backdrops are refused (silhouette must contrast)', edited.meta.background === '');
  updateAsset(cam.id, { status: 'rejected' });
  check('rejecting a model un-publishes its upcoming dates', puzzleFor(tomorrow) === null);
  check('a model that already ran cannot be deleted', throws(() => deleteAsset(wing.id, true)));
  deleteAsset(cube.id, true);
  check('deleting removes the registry entry and file', getAsset(cube.id) === null && !fs.existsSync(path.join(PATHS.library, 'random', 'cube.obj')));

  db().close();
}

main()
  .catch((e) => { failures.push(`crashed: ${(e as Error).stack}`); console.error(e); })
  .finally(() => {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* Windows may still hold the db file */ }
    console.log(`\n${passed} passed, ${failures.length} failed`);
    if (failures.length) { console.log(failures.map((f) => `  - ${f}`).join('\n')); process.exit(1); }
  });
