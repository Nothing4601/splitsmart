# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SplitSmart: a receipt-scanning, item-by-item bill splitter with settle-up, live sync
between phones and a three.js character system. The whole app is one file,
`index.html` (CSS, markup and script inline); beside it are `sw.js` +
`manifest.webmanifest` + `icons/` (PWA), `assets/brand/smart-split-intro.mp4` (the ≤3s
brand intro the splash plays) and `test/logic.test.mjs`. There is no build step,
package manager or linter.

## Run

```bash
python3 -m http.server   # then open http://localhost:8000
node --test              # unit tests for the money/parsing logic
```

Lazy-loaded at runtime (never on first paint): Tesseract.js 5.1.1 + `tessdata_fast`
from jsDelivr (first scan), Transformers.js 3.0.2 + `Xenova/mobilebert-uncased-mnli`
in a module Web Worker built from a Blob (first review), qrcode-generator 1.4.4 (first
QR), and `Xenova/whisper-tiny.en` in a second Blob worker (first *Say it*).

three.js r147, `OrbitControls` and `RoomEnvironment` are loaded as globals (`THREE`,
`THREE.OrbitControls`, `THREE.RoomEnvironment`) from jsdelivr via plain `<script>`
tags, not ES modules. Keep to the r147 API (e.g. `outputEncoding`/`sRGBEncoding`,
`examples/js/` controls); newer three.js releases removed these.

## Design

Light "paper & ink": a warm off-white sheet (`--paper`) over a faint painterly wash,
white cards with a hairline border, indigo ink (`--accent` `#252f91`) and one
electric-blue accent (`--blue` `#426bff`). Fraunces for anything read as a headline or
an amount, Plus Jakarta Sans for anything clicked. The shell is a left rail from
1024px up (Hisaab / Gangs / Scan / Me) and a bottom tab bar below that; the character
lobby is the one dark surface and keeps its own `--night`/`--cream` tokens.

## Architecture

`<script id="split-logic">` comes first and must stay DOM-free: it defines
`window.SplitLogic` (`allocate` largest-remainder rounding, `itemizedShares`,
`manualShares`, `balances`, `settle` exact-minimum DP, `parseReceipt`, `checkTotals`,
`upiLink`, `guessCategory`, `mergeGroups`, `parseSpoken`/`normaliseSpeech`,
`parseAssignSpeech`). All money is integer paise. `test/logic.test.mjs` extracts this
block from index.html and runs it in `vm`, so keep the `id` and keep it self-contained.

Main script, top to bottom:

- **Character engine**: `M`/`LACQ`/`FAB`/`GOLD` materials, one-letter shape helpers
  (`S`, `B`, `Cy`, `Co`, `T`, `Cap`, `hemi`, `put`), `canvasTex`, the `CHARS`
  definitions with `PART_NAMES`, `buildCharacter`, the pose/`EMOTES` keyframe
  animation, the shared hidden `cardRenderer` that paints portraits into 2D canvases
  (`drawActor`, `drawStill`, `portraitURL`), the roster ring, gallery, creator, and
  the `frame()` rAF loop. The engine itself should stay untouched.
- **Group data**: `{ id, name, created, members: [{ id, name, charId, upi?, me? }],
  expenses, settlements, recurring, activity }`; `normaliseGroup` migrates older
  saves. Every mutation goes through `commit(g, logText)` (activity log, save,
  re-render), which also calls `stampChanges` for sync, so never mutate a saved group
  without `commit`, and give new records unique ids (`uid()`). `groupState(g)` derives
  balances and suggested payments.
- **Shell**: `showView(name)` switches between the four pages by toggling
  `#home [data-view]`; `markNav` lights the rail and the tab bar. `#group/<id>`,
  `#sync=` and `#import=` still go through `route()` on `hashchange`. `showView('me')`
  opens the profile page, which is where the character lobby is reached from.
- **Live sync**: a shared group has `syncKey`; `commit` calls `schedulePublish`, and
  `publishGroup` posts AES-GCM sealed, deflated records to an ntfy.sh topic derived
  from the key. `syncTick` polls and merges via `applyRemote`.
- **Scanner** (`openScanner`, state in `scan`): capture → `readCurrent` (canvas
  `preprocess`, Tesseract PSM 6) → review (`scan.draft`) → assign → `saveReceipt`
  (photo to IndexedDB via `imgDB`).
- **Say it** (`openVoice`) and **Say who had what** (`openAssignVoice`) share
  `voiceSheet`: record → `transcribe` (Whisper worker) → editable transcript →
  `L.parseSpoken` drafts.
- **Charts**: `donutChart`, `hbarChart` and `vbarChart` all emit a `data-tip`
  attribute of `label|amount|share`; the cursor layer reads it to drive one shared
  `.ctip` tooltip and the dim/highlight states.
- **The cursor layer** (end of the script): one passive `pointermove` feeds one rAF
  `frameTick` that writes CSS custom properties and transforms only. It drives the
  card spotlight (`[data-spot]` + `.glow`), the gang-card 3D tilt (`[data-tilt]`),
  magnetic primary buttons (`[data-magnet]`), settlement-row highlighting
  (`.pay-row.hot` + `.list.dimmed`), the chart tooltip, and the dot-and-ring cursor.
  All of it is gated on `(hover: hover) and (pointer: fine)` and
  `prefers-reduced-motion`.
- **Splash**: `bootSplash` plays the intro video once per browser session (skipped
  when `sessionStorage.ss-intro` is set or under reduced motion), with a skip button,
  a 3.05s hard cap, and a pure-CSS fallback if the video errors. `body.ready` gates
  the staggered page entrance.
- **Persistence**: `localStorage` keys `splitsmart-groups`, `lobby-customs`,
  `lobby-name`, `lobby-char`, `lobby-upi`, `splitsmart-sync`, `splitsmart-device`;
  receipt photos in IndexedDB `splitsmart`/`receipts`. All access is in try/catch.

## Conventions when changing things

- A fresh install must stay empty: `exampleGroups()` returns `[]` and `loadGroups()`
  drops anything flagged `example`. Don't seed demo data.
- New built-in character: append to `CHARS` **and** add a matching row to `PART_NAMES`
  at the same index; give it an `emote` key that exists in `EMOTES`. Inserting in the
  middle shifts indexes and breaks saved custom specs in users' `localStorage`.
- Money logic belongs in the `split-logic` block with a test in
  `test/logic.test.mjs`; UI code only calls it. Format with `rupees()`.
- Expense/settlement `parts` and balances key members by `mid`, never by name or
  index.
- Escape user text with `esc()` when building HTML strings.
- Keep it a static site deployable to GitHub Pages: app code stays in `index.html`, no
  bundler, no backend. Bump `CACHE` in `sw.js` when cached shell files change shape.
- Cursor effects are decorative: anything they reveal must also be reachable without
  hover, and nothing may block a click. Add new ones through the existing
  `data-spot` / `data-tilt` / `data-magnet` / `data-tip` hooks rather than new
  listeners.
