# Thingle

A daily 3D silhouette deduction game. Every day one mystery object is shown as a solid black
silhouette, rendered live from a real 3D model. Players get five guesses and three optional hints.
When the game ends the object is revealed in its original colours.

- [1. Install and run](#1-install-and-run)
- [2. Where to place 3D models](#2-where-to-place-3d-models)
- [3. Supported formats](#3-supported-formats)
- [4. Adding model metadata](#4-adding-model-metadata)
- [5. Previewing and configuring silhouettes](#5-previewing-and-configuring-silhouettes)
- [6. Scheduling daily puzzles](#6-scheduling-daily-puzzles)
- [7. Admin access](#7-admin-access)
- [8. Importing publicly licensed models](#8-importing-publicly-licensed-models)
- [9. Configuring hints and scoring](#9-configuring-hints-and-scoring)
- [10. Player feedback](#10-player-feedback)
- [11. Sound and the case folder](#11-sound-and-the-case-folder)
- [How it works](#how-it-works) · [Testing](#testing) · [Deploying](#deploying) · [Troubleshooting](#troubleshooting)

---

## 1. Install and run

Requires **Node.js 22.13 or newer** (the game uses Node's built-in SQLite, so there is nothing else to install).

```bash
npm install
npm run seed     # first run only: registers the 15 sample models and schedules two weeks of puzzles
npm run dev
```

Open <http://localhost:3000> to play, and <http://localhost:3000/admin> for the admin dashboard
(development password: `shadowplay`).

> The game was first built under the working title *Shadowplay*. The name players see is Thingle,
> but internal names were left alone so existing data keeps working: the `assets/shadowplay/` and
> `storage/shadowplay/` folders, `data/shadowplay.db`, and the development password.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` then `npm start` | Production build and server |
| `npm run seed` | Generates the sample models, registers and approves them, schedules them around today. Safe to re-run: it never touches your own models or dates that are already taken |
| `npm run scan` | Scans the asset folder from the command line (same as the admin "Scan asset folder" button) |
| `npm run models` | Regenerates the sample `.glb` files only |
| `npm test` | Runs the automated checks (uses a temporary copy; never touches your data) |
| `npm run typecheck` | TypeScript check |

The sample models are simple procedurally generated objects (camshaft, spark plug, F1 front wing,
vacuum tube…) released as CC0 so the game is playable out of the box. Replace them with your own.

## 2. Where to place 3D models

Models live in **`assets/shadowplay/`**, in a subfolder per category:

```
assets/shadowplay/
  automotive/   motorsport/   aerospace/   technology/   electronics/
  gaming/       industrial/   medical/     animals/      pokemon/      random/
```

You can add folders of your own. The folder name is only a convenience: when it matches a
category (`automotive`, `motorsport`, `industrial` → *Industrial machinery*, …) the category is
pre-filled. You can always change it in the admin dashboard.

This folder is deliberately **outside `public/`**. Model files are never served by filename;
players receive them through `/api/model/<opaque id>`, and only once that puzzle has been released.

To add a model, either:

- **copy the file into a category folder**, then press **Scan asset folder** in the admin library
  (or run `npm run scan`); or
- use **Upload model** in the admin library, which saves it into the folder for you.

On detection the system validates the file, gives it a unique asset ID (from its content hash),
reads its geometry and dimensions, renders a thumbnail and four silhouette previews, and registers
it **in review**. Nothing is ever published automatically — see [scheduling](#6-scheduling-daily-puzzles).
No source code changes are needed to add puzzles.

Generated files go to `storage/shadowplay/` (`thumbnails/`, `previews/`, `processed/`) and the
registry, schedule and player progress to `data/shadowplay.db`. All of these are git-ignored.

- **Duplicates** are detected by file content. The same file under another name is reported and skipped.
- **Renamed or moved** files are re-linked to their existing entry on the next scan.
- **Deleted** files are flagged "File missing"; the entry and its history are kept.

## 3. Supported formats

| Format | Notes |
| --- | --- |
| `.glb` | Recommended. Used as-is. Draco and Meshopt compression are supported |
| `.gltf` | Supported. Keep the `.bin` and texture files next to it in the folder. (The upload button only takes self-contained `.gltf`; for multi-file models copy the whole folder in and scan.) Converted to a single `.glb` in `storage/shadowplay/processed/` |
| `.obj` | Geometry only (materials are ignored, so the reveal is plain grey). Converted to `.glb` |
| `.stl` | ASCII or binary. Geometry only. Converted to `.glb` |

Upload limit is 150 MB, but keep models small — a few MB and under ~200k triangles loads quickly
on phones. Only static geometry is shown; animations are ignored.

## 4. Adding model metadata

Open a model from the admin library to edit everything about it:

| Field | Required to approve | Notes |
| --- | --- | --- |
| Display name | yes | Internal name. Never sent to players before the reveal |
| Correct answer | yes | Shown on the results screen |
| Accepted alternative answers | | One per line |
| Category / subcategory | category | |
| Difficulty | | Easy, medium, hard or expert — your call |
| Description | | Shown with the answer after the game |
| Hint 1 (category reveal) | yes | |
| Hint 2 (function / context clue) | yes | |
| Rotation allowance | | Degrees each way, default ±30° sideways, ±15° up / down |
| Starting camera angle, backdrop, ground shadow | | Set in the preview tool |
| Source website, source URL, creator | | |
| Licence | yes | A model cannot be approved without one |
| Attribution line | | Shown to players on the results screen |

The asset ID, original filename, date added, date last used and publication status are tracked
automatically. A model with required fields missing is marked **Requires configuration** and
cannot be approved or scheduled.

**Answer matching** is strict but forgiving about formatting: capitals, punctuation, hyphens,
accents, extra spaces, spacing inside a word (`cam shaft` = `camshaft`) and a leading "a / an / the"
are ignored. Small spelling mistakes are forgiven too: `vaccum tube` and `vaccuum tube` both match
`vacuum tube`. The allowance grows with length (1 typo for 6–9 letters, 2 for 10–14, 3 beyond), words of
5 letters or fewer must be exact, the first letter must be right and numbers must match (`F2` is not `F1`).
A genuinely different name still has to be listed. The editor has a "Try a guess" box to check.

### Optional: metadata sidecar file

To pre-fill metadata when a model is first detected, put a JSON file with the same name next to it,
e.g. `front-wing.glb` + `front-wing.meta.json`:

```json
{
  "displayName": "F1 Front Wing",
  "answer": "F1 Front Wing",
  "accepted": ["Formula 1 front wing", "Racing front wing", "Front wing"],
  "category": "Motorsport",
  "subcategory": "Aerodynamics",
  "difficulty": "hard",
  "description": "A multi-element front wing with endplates.",
  "hint1": "Motorsport",
  "hint2": "This component plays an important role in aerodynamic performance.",
  "rotation": { "h": 30, "v": 15 },
  "camera": { "az": -18, "el": -58, "roll": 24, "zoom": 1.15 },
  "sourceSite": "Example site",
  "sourceUrl": "https://example.com/model",
  "creator": "A. Creator",
  "licence": "CC BY 4.0",
  "attribution": "\"Front Wing\" by A. Creator, CC BY 4.0"
}
```

Every field is optional. The sidecar is read once, at registration; after that the admin dashboard
is the source of truth. A sidecar still does not publish anything — the model arrives in review.

## 5. Previewing and configuring silhouettes

The model editor (`/admin` → click a model) has the silhouette preview tool on the left.

**Starting angle tab**

- Drag to rotate freely, scroll to zoom, arrow keys to nudge; or use the Turn / Tilt / Roll / Zoom sliders.
- **Silhouette / Original** switches between what players see and the real materials.
- Click one of the four generated previews to jump to that angle.
- Press **Use this view as the starting angle**, then **Save draft**.
- **Backdrop** (paper, white, pale grey, grey) and **Soft ground shadow** are per puzzle.

**"How revealing is this view"** — the meter compares the silhouette's area at this angle with the
slimmest and broadest profiles the object has. Near 100% you are looking at its most open, most
recognisable side, and the meter turns red; approving a model whose starting angle is that open
asks you to confirm. It is a guide, not a judge: an object can be obvious from a slim angle too, so
always look at the shape yourself.

**Test rotation hint tab** shows exactly what a player gets after buying the rotation hint: the
silhouette can be dragged within the allowance around the starting angle, with the same
"degrees left" gauges. Change the allowance underneath and try again.

**Preview as player** opens the complete player experience for that model (guesses, hints, reveal,
results) without touching anyone's statistics. "Start over" replays it.

How the silhouette is drawn: the model is loaded with Three.js, centred and scaled so its bounding
sphere always fits the frame with the same margin, every material is replaced by flat unlit black,
and lines, points and lights are hidden. The geometry itself is untouched. The server-side
thumbnails use the same camera maths, so previews match the game.

## 6. Scheduling daily puzzles

A model goes through three steps, and each is a deliberate action by you:

1. **In review** — where every newly detected model starts.
2. **Approved** — press *Save & approve* in the editor once the metadata is complete. Approving
   does not publish anything.
3. **Scheduled** — give it a date on `/admin/schedule` (or in the editor's Schedule panel).

On the calendar:

- **+ Assign a case** picks a model for a day, either as a **draft** (holds the date, not published)
  or **scheduled** (published on that day).
- **Fill empty days** pencils unused approved models into empty days as drafts, in the order they
  were added; **Schedule all drafts** publishes them. There is no random selection at runtime —
  players only ever get what the calendar says.
- **Test** plays any upcoming day exactly as players will (development mode, admin only).
- You can plan as many weeks ahead as you like (*Show 4 more weeks*).
- Past days are read-only so the archive and player records stay intact.

Rules the server enforces:

- Everyone gets the same puzzle on the same date. The day changes at midnight in the configured
  timezone (default **Australia/Melbourne**, changeable in Settings).
- Players cannot load future puzzles, their models or their metadata.
- If nothing is scheduled for today, players see a "No case filed" screen.
- Rejecting or archiving a model pulls its upcoming dates back to draft.
- A model that has already run cannot be deleted (archive it instead).
- Released puzzles before today appear in the **Case archive** for practice. Practice games never
  affect daily statistics or streaks.

## 7. Admin access

The dashboard is at **`/admin`** (there is a small "Records room" link in the site footer).

Copy `.env.example` to `.env.local` and set:

```
ADMIN_PASSWORD=your-password
ADMIN_SECRET=a-long-random-string
```

- In development, if `ADMIN_PASSWORD` is not set, the password is `shadowplay`.
- In production there is **no fallback**: without `ADMIN_PASSWORD` the dashboard stays locked.
- `ADMIN_SECRET` signs the session cookie. Sessions last 12 hours; repeated wrong passwords are
  rate-limited.
- Every admin page and every `/api/admin/*` route checks the session independently.

There is a single shared admin password rather than user accounts.

## 8. Importing publicly licensed models

**A model being publicly viewable does not mean it can be downloaded, modified or used in a game.**
Before adding any model:

1. Check the licence on the model's own page and make sure it permits this use.
   - Generally fine: **CC0 / public domain**, **CC BY** (with credit), **CC BY-SA**, your own work,
     or a purchased licence that covers use in a game.
   - **CC BY-NC** only if the game is never monetised. **CC BY-ND** is risky: converting and
     re-rendering may count as an adaptation.
   - Not usable: "all rights reserved", view-only models, anything with unclear rights.
2. Download it manually through the site's own download button, within its terms of use.
   Do not scrape, and do not use tools that bypass a site's download restrictions.
3. Put it in `assets/shadowplay/<category>/` and scan.
4. In the editor's **Source & licence** section record the source website, source URL, creator,
   licence and the attribution line the licence asks for. The editor warns about non-commercial,
   no-derivatives and unclear licences, and about missing attribution.
5. Approve and schedule.

Attribution is preserved: the creator, licence and attribution line are shown on the results
screen once the puzzle is over (never before, since that could give the answer away).

**Characters and brands.** A permissive licence on a fan-made model does not cover the underlying
character or design. Pokémon, film props, branded products and similar are someone else's
intellectual property however the model file is licensed. The `pokemon/` folder exists because it
was asked for, but get permission before publishing anything like that.

There is intentionally no automatic URL importer. If one is added later it should only talk to
sources with an authorised API and should fill in the same source / creator / licence fields; the
game does not depend on it.

## 9. Configuring hints and scoring

**Global rules** — `/admin/settings`:

- Points for solving on each guess (default 500 / 400 / 300 / 200 / 100; failing scores 0).
- Hint costs (default category −50, function −100, rotation −100). The score never drops below 0.
- Timezone for the daily changeover.

**Per puzzle** — in the model editor: the text of hint 1 and hint 2, and the rotation allowance.

How hints behave: each can be used once, in any order, and never consumes a guess. The rotation
allowance is a window around the starting angle (±30° means 30° either way), the silhouette stays
black, and the gauges show how much turn is left. There is no speed bonus.

## 10. Player feedback

After a daily or practice case ends, players are asked once how it went: a seven-step scale from
**Extremely easy** to **Extremely hard**, plus an optional comment. They can skip it, and a
"Rate this case" button on the results screen lets them answer or change their answer later.

Read it at **`/admin/feedback`**:

- filter by day range, by thing, and by daily / practice;
- one line per day and thing with the number of responses, average felt difficulty, the spread
  across the seven steps, how many respondents solved it, average guesses and average score;
- every individual response with its comment;
- **Export CSV** downloads whatever the filters currently show.

Each response is stored in the `feedback` table of `data/shadowplay.db` with the puzzle date, the
model's asset ID, the answer at the time (kept even if the model is deleted later), the rating,
the comment, and how that player's game went (solved or not, guesses, hints used, score). There is
one response per player per puzzle; answering again replaces it.

## 11. Sound and the case folder

- **Sound effects** are generated in the browser (no audio files): a pencil scratch when a wrong
  guess is struck out, and a stamp followed by a soft chime when the case is solved. The
  **Sound on / off** button in the header mutes them and the choice is remembered.
- **The case folder** opens when a case loads. The folder and its opening animation are CSS 3D
  transforms, which the browser runs on the GPU. The **paperclip** is a real Three.js model (a
  bent steel wire) that is rendered once into an image; its WebGL context is then released, so it
  costs nothing while playing. People who have "reduce motion" switched on get no animation.

---

## How it works

- **Stack**: Next.js (App Router) + React + TypeScript, Tailwind CSS, Three.js for rendering,
  SQLite via Node's built-in `node:sqlite`.
- **Server-authoritative**: answers, hints and unreleased models never reach the browser. Guesses
  are checked on the server and progress is stored there against an anonymous cookie, so a refresh
  keeps guesses, hints and results.
- **Ready for accounts**: plays are stored per player id (`players` and `plays` tables). Adding
  sign-in later means attaching an account to a player id; leaderboards can be built from `plays`.

```
assets/shadowplay/        model library (you add files here)
storage/shadowplay/       generated thumbnails, previews, converted models
data/shadowplay.db        registry, schedule, settings, player progress
scripts/                  seed, scan, sample-model generator, tests
src/app/                  pages and API routes (admin under src/app/admin, src/app/api/admin)
src/components/           game UI, 3D viewer, admin dashboard
src/lib/                  game rules, scoring, ingestion, scheduling, rendering maths
```

## Testing

`npm test` runs 89 checks against a temporary library and database: answer matching, scoring,
five-guess limit, hints, persistence, timezone, ingestion of all four formats, duplicate detection,
review-before-publish, scheduling rules, future-puzzle protection, practice mode, statistics,
player feedback and silhouette blackness.

## Deploying

The game writes to `data/` and `storage/` and reads `assets/`, so it needs a host with a
persistent disk (a VPS, Railway, Fly.io, Render with a disk…). It will not work as-is on
serverless hosts with a read-only filesystem such as Vercel. Set `ADMIN_PASSWORD` and
`ADMIN_SECRET`, run `npm run build` and `npm start`, and back up `data/shadowplay.db`.

## Troubleshooting

- **"No case filed"** — nothing is scheduled for today's date in the game timezone. Run
  `npm run seed`, or schedule a model in the admin calendar.
- **A new model does not appear** — press *Scan asset folder*; the report lists files that failed
  to load and why.
- **OneDrive / Dropbox folders** — if the project lives in a synced folder, the sync client can
  briefly lock `data/shadowplay.db`. If you see "database is locked" errors, pause syncing or move
  the project elsewhere.
- **Sample dates have run out** — `npm run seed` only schedules samples that have never been
  scheduled. Assign dates in the admin calendar instead.
