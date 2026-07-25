# Changelog

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
