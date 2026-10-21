# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser character lobby built with three.js: a gallery-style home page (header with profile, full-bleed hero, collection grid, atelier section) and a full-screen lobby that opens over it. The whole app is one file, `index.html` (CSS, markup and script inline). There is no build step, package manager, linter or test suite.

## Run

```bash
python3 -m http.server   # then open http://localhost:8000
```

three.js r147, `OrbitControls` and `RoomEnvironment` are loaded as globals (`THREE`, `THREE.OrbitControls`, `THREE.RoomEnvironment`) from jsdelivr via plain `<script>` tags, not ES modules. Keep to the r147 API (e.g. `outputEncoding`/`sRGBEncoding`, `examples/js/` controls); newer three.js releases removed these.

## Architecture (script section of index.html, top to bottom)

- **Materials**: `M(color, o)` makes a `MeshPhysicalMaterial`; `LACQ` (clear-coated gloss), `FAB` (fabric sheen) and the shared `GOLD`/`IVORY`/`INK` give the luxury finish. Reflections come from a `RoomEnvironment` PMREM per renderer; `envMapIntensity` is kept low (0.3) on non-metals or colours wash out.
- **Shape helpers**: one-letter factories ( `S` sphere, `B` box, `Cy`, `Co`, `T` torus, `Cap` capsule, `hemi`) and `put(parent, geo, mat, x,y,z, rx,ry,rz, [scale])`, which every character part goes through. `canvasTex` builds procedural textures (no image assets anywhere).
- **`CHARS`**: the character definitions. Each is plain data (name, emote key, label, colours for skin/top/bottom/shoe, flags like `longSleeve`, `puffy`, `shorts`) plus a `dress(head, joints)` function that adds head gear onto the shared body, and an optional `topExtra(joints)`. `PART_NAMES` (same order as `CHARS`) names each character's head/top/bottom part for the creator.
- **`buildCharacter(c)`**: builds the shared chibi body as a hierarchy of `THREE.Group` joints (`spine, neck, shL, elL, shR, elR, hipL, knL, hipR, knR`), then calls `c.dress`. Returns `{ root, joints }`. Every view builds its own copy; meshes are never shared between scenes.
- **Animation**: a pose is `{ joint: [rx, ry, rz], rootY, rootR }` with missing joints = 0. `EMOTES[key]` is a list of `[time, pose]` keyframes; `samplePose` interpolates with smoothstep, `idlePose` is the breathing loop after a move ends, `applyPose` adds the `BASE` rest offsets. An **actor** is `{ ch, c, start }`, and `animate(actor, now, loop)` poses it from its own clock (`start = -99` means "already idle").
- **Two renderers**: the main `renderer` draws the plinth scene (`stage` group: marble/walnut plinth + character). Its canvas is moved between `#heroStage` (home: fixed camera via `heroView`, controls disabled, plinth turns slowly) and `#lobbyStage` (lobby: orbit via `lobbyView`) by `mountStage`; `view` is `'home'` or `'lobby'`. A single hidden `cardRenderer` (`preserveDrawingBuffer: true`) draws every small card: `drawActor` temporarily adds the actor to `cardScene`, renders, removes it, and copies the pixels into that card's 2D `<canvas>`. `faceCam` gives head-and-shoulders portraits; `drawActor` crops to the target canvas shape. Adding more cards means more renders per frame through this one renderer, so `drawCards` redraws idle cards only every 6th frame.
- **Roster ring**: one card per character, indexed by character id. `cur` is the pedestal character; `layoutCards` computes each card's seat (-1..3, or `null` = parked) from its position on the circle relative to `cur` and only sets CSS transforms. `select(id)` is the single entry point for changing the pedestal character.
- **Home**: `buildTiles` renders the collection (still until hovered, then the move loops); `drawGroupShot` renders the atelier group portrait once. `enterLobby(id)` / `leaveLobby()` switch views.
- **Profile**: `profile = { name, charId }`; the drawer (`setDrawer`) lets you edit the name and pick a character (`chooseCharacter`), which updates every `[data-pname]`, `[data-pchar]` and `[data-profile] canvas`, the hero, and the lobby start character.
- **Gallery** (`#gallery` overlay): all characters in a grid, still until hovered/focused; only the hovered actor is animated (looping).
- **Creator**: a `draft` spec `{ name, h, t, b, s, emote }` holds the indexes of the head/top/bottom donor characters and a skin index into `SKINS`. `compose(spec)` turns a spec into a character object by borrowing fields from those donors. Donor indexes range over `BASE_COUNT` (the original built-in characters only), so customs can't be donors.
- **Persistence**: `localStorage` keys `lobby-customs` (array of creator specs, re-composed and appended to `CHARS` on load) `lobby-name` (profile name) and `lobby-char` (profile character id). All access is wrapped in try/catch.
- **`frame()`**: the single rAF loop. Animates the pedestal actor (with a scale pop-in), On home it renders the hero only while it is on screen and animates the hovered tile; in the lobby it renders the stage and draws the roster cards when the gallery is closed, or only the hovered gallery card when open.

## Conventions when changing things

- New built-in character: add an entry to `CHARS` **and** a matching row to `PART_NAMES` at the same index; give it an `emote` key that exists in `EMOTES` (or add one). Inserting in the middle shifts indexes and breaks saved custom specs in users' `localStorage`; append instead.
- New emote: add keyframes to `EMOTES`; it shows up in the creator dropdown via `EMOTE_LABEL`, which is built from the `label` of the character that uses it, so at least one character must use it.
- Keep it a single static file deployable to static hosting (GitHub Pages style): no bundler, no backend.
