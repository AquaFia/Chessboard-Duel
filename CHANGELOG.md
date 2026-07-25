# Changelog

## Phase 1 cleanup — Required personality profiles

- Removed the obsolete top-level `playstyle` objects from Jace and Juno.
- Removed all fallback brain generation and legacy character behavior.
- Every roster character must now provide a complete `personalityProfile`.
- Character files are validated when loaded, with a direct error naming the
  missing profile section.
- Removed the unused generated `adaptation` value.
- Updated the README so it no longer describes backwards compatibility.


## Phase 1 — Character Brains

### Character files

- Added the complete Notion personality export to Jace and Juno as
  `personalityProfile`.
- Increased their character schema version to 2.

### `app.js`

- Added `generateBrain()`, which converts the readable Notion profile into a
  temporary in-memory chess personality.
- Added Elo-based move consistency and candidate breadth.
- Added personality preferences for tactics, aggression, material, king
  safety, complexity, simplification, novelty, queen activity, and pressure.
- Jace is now pulled toward tactical, unusual, complicated positions.
- Juno is now pulled toward initiative, pressure, queen activity, traps, and
  psychologically forcing positions.
- No framework, build system, additional JavaScript file, or generated brain
  file was added.


## Human turn selection fix

### Updated file

- `app.js`
  - Human players can switch freely between their own pieces before moving.
  - Clicking the selected piece again cancels the selection.
  - Clicking an illegal destination keeps the piece selected instead of locking the turn.
  - All legal movement and turn rules remain enforced by the chess engine.


## New Match restart behavior

### Updated file

- `app.js`
  - The **New Match** button now immediately starts a fresh game using the currently selected characters and player/AI modes.
  - The setup modal is no longer reopened when starting a rematch.


## Reading controls and timeline update

### Updated files

- `index.html`
  - Removed the duplicate Setup button from the board controls.
  - Replaced `Step AI` with `Last Move` and `Next Move`.
  - Replaced the preset speed dropdown with a reading-speed slider.
  - Corrected the setup hint to describe `characters/characters.json`.

- `app.css`
  - Made the Match Timeline grow naturally down the page instead of using a short internal scroll box.
  - Added responsive slider styling.
  - Updated the control layout for desktop and mobile.

- `app.js`
  - Added one-move rewind behavior.
  - Added one-move AI advance behavior.
  - Added live reading-speed slider labels.
  - Updated button enabled/disabled states.
  - Removed horizontal timeline auto-scrolling.

### Unchanged

- `characters/`
- `assets/`
- `README.md`
- Character dialogue and expression data
- Move-selection logic


# UI Update

Modified:
- index.html
- app.css
- app.js

Added:
- CHANGELOG.md

Changes:
- Removed shared bottom dialogue box.
- Added dialogue panel under each portrait.
- Active speaker card glows.
- Each character keeps their last spoken line.
