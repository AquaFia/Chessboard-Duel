# Changelog

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
