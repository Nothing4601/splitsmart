# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SplitSmart: a premium dark expense-splitting app with the three.js character system baked in. Hash-routed SPA views (dashboard, groups, group detail with balances/settle, activity, profile) plus the full-screen character lobby reachable from the profile page. The whole app is one file, `index.html` (CSS, markup and script inline), plus one binary asset: `assets/brand/smart-split-intro.mp4` (the ≤3s brand intro played by the splash). There is no build step, package manager, linter or test suite.

## Run

```bash
python3 -m http.server   # then open http://localhost:8000
```

three.js r147, `OrbitControls` and `RoomEnvironment` are loaded as globals (`THREE`, `THREE.OrbitControls`, `THREE.RoomEnvironment`) from jsdelivr via plain `<script>` tags, not ES modules. Keep to the r147 API (e.g. `outputEncoding`/`sRGBEncoding`, `examples/js/` controls); newer three.js releases removed these.

## Architecture (single `<script>` in index.html, top to bottom)

- **Character engine (unchanged from the original lobby)**: `M`/`LACQ`/`FAB`/`GOLD` materials, one-letter shape helpers, `canvasTex`, the 12 `CHARS` definitions, `PART_NAMES` mix-and-match, `compose`, `buildCharacter`, pose/`EMOTES` keyframe animation, the shared `cardRenderer` that paints portraits into 2D canvases (`drawActor`, `drawStill`, `portraitURL`), the roster ring (`select`, `layoutCards`), gallery, atelier/creator, and the `frame()` rAF loop. The lobby chrome (buttons, nameplate, dock) is styled by the app CSS; the engine itself should stay untouched.
- **SplitSmart app code (after the engine)**: helpers (`$`, `esc`, paise math `toPaise`/`money`/`moneyShort`), toasts + success `burst`, profile (localStorage `lobby-name`/`lobby-char`), the groups/expense data layer, the balance engine (`computeShares` — exact integer-paise shares with remainder distribution; `groupBalances`; `simplify` — greedy fewest-payments), the hash router (`route`, `withSkeleton` loading state, `go`), and one render function per view (`renderDashboard`, `renderGroupsView`, `renderGroupDetail`, `renderActivity`, `showProfile`), plus overlays: new-group modal, add-expense sheet (`sheet` state + `recalcSheet`), settle modal, expense-detail modal, group picker.
- **Splash**: `bootSplash` plays the intro video once per browser session (skipped when `sessionStorage.ss-intro` is set or `prefers-reduced-motion`), with a skip button, a 3.05s hard cap, and a pure-CSS fallback animation if the video errors. `body.ready` gates the entrance animations.

## Data model (localStorage `splitsmart-groups`)

Group = `{ id, name, created, meMid, members: [{ name, charId, mid }], expenses, settlements }`. `meMid` marks which member is the profile user (first member at creation). Expense = `{ id, desc, amount (rupees), cat, payer (mid), date (ISO), split: { type: 'equal'|'amounts'|'percent'|'shares', parts: [{ mid, value }] } }` — for `equal`, presence in `parts` means included and `value` is ignored. Settlement = `{ id, from, to, amount (rupees), date, note }`. All math is done in integer paise. `loadGroups` migrates legacy groups (adds `mid`s, `meMid`, empty `expenses`/`settlements`). `EXAMPLE_GROUPS` seed first-run data and are flagged `example`.

## Conventions when changing things

- Keep it a single static file deployable to static hosting (GitHub Pages style): no bundler, no backend. The intro video under `assets/brand/` is the only binary.
- New built-in character: add an entry to `CHARS` **and** a matching row to `PART_NAMES` at the same index; give it an `emote` key that exists in `EMOTES` (or add one). Inserting in the middle shifts indexes and breaks saved custom specs in users' localStorage; append instead.
- New emote: add keyframes to `EMOTES`; it shows up in the creator dropdown via `EMOTE_LABEL`.
- Expense/settlement `parts` and balances key members by `mid`, never by name or index — keep it that way so renames and ordering stay safe.
- View renders write into `#app` via `innerHTML`; dynamic covers use `data-cover` + `drawArt` and are painted by `mountExtras`. If you add a view, route it in `route()` and add it to `navKey` so the nav pills highlight.
- Respect `prefers-reduced-motion` (the CSS kills animations; the splash skips).
