# Phase 12 — Cognitive Architecture

- Replaced Elo-based strength control with explicit per-character cognitive profiles.
- Added vision, calculation, evaluation, planning, conversion, defense, initiative, confidence, adaptability, and risk tolerance.
- Removed the obsolete Elo midpoint pipeline and its move-selection controls.
- Added cognitive tactical blindness, skill-specific evaluation noise, plan reliability, candidate breadth, and mistake behavior.
- Rebalanced Daika so caution does not translate into expert tactical defense or conversion.
- Added a hidden-by-default AI Diagnostics panel for intent, plan, cognitive values, candidate scores, and the chosen move.
- Kept intent-based chess, opening identity, adaptive memory, chemistry, dialogue, and match review as active systems.

# Changelog

## Phase 11 — Intent-Based Chess

- Replaced the direct move-score pipeline with position analysis, intent selection, plan construction, candidate evaluation, skill distortion, and final selection.
- Added one shared objective position report for phase, material, center state, king safety, development, initiative, tension, and passed-pawn potential.
- Added character-weighted intents and intent-specific move priorities.
- Added live status text showing the active character intent.
- Preserved Phase 10 Elo search, evaluation noise, conversion logic, openings, and adaptive memory.
- Deleted the superseded `personalityScore()` and `moveScore()` functions; no compatibility or fallback path remains.

## Phase 10 — Human Strength Simulation

- Added Elo-based search depth and alpha-beta calculation.
- Added skill-based evaluation noise and candidate breadth.
- Added conversion reliability using endgame knowledge, practical accuracy, and discipline.
- Added strong penalties for repetition, stalemate, and immediate draws while ahead.
- Reduced personality bonuses so they choose among viable moves instead of masking major skill gaps.
- Preserved opening identity, adaptive memory, relationship dialogue, manual controls, and match review.

## Phase 9 — Adaptive Character Memory

- Added temporary per-match memory for both characters.
- Characters react to recent checks, captures, material swings, repeated piece
  movement, opening deviations, failed checking attempts, and retaliation
  opportunities.
- Added a bounded memory modifier to AI move scoring.
- Added contextual dialogue events with normal and relationship fallbacks.
- Added contextual lines for Jace and Juno.
- Match memory resets on start and rematch.
- Rewinding reconstructs memory from the remaining move history.


## Phase 8 — Opening Identity

- Added optional weighted opening repertoires for White and Black.
- Added a weighted `freeformWeight` option for characters who may ignore their
  usual repertoire.
- Opening lines use full SAN histories and stop immediately after an opponent
  deviation, an illegal next move, or the end of the line.
- Normal personality scoring takes over cleanly after leaving theory.
- Opening choices use the seeded RNG for reproducible simulations.
- The match status identifies a character's active named opening.
- Added opening profiles for Jace and Juno.
- Added schema validation for opening profiles, weights, names, and SAN arrays.


## Manual simulation start

- Starting a match no longer begins AI play automatically.
- Rematches also initialize in a paused state.
- The **Run** button must be pressed manually to start the simulation.
- Removed the automatic scheduling call rather than retaining a disabled path.


## Phase 7 — Character Chemistry

- Added optional pair-specific relationship dialogue to character JSON.
- Added matchup-aware opening lines for both characters.
- Added chemistry lines for ordinary moves, captures, checks, wins, losses, and draws.
- Added schema validation for relationship event groups.
- Replaced the old single-character dialogue selector with one opponent-aware path.


## Phase 6 — Rematch cleanup

- Renamed the main **New Match** control to **Rematch**.
- Removed the redundant button area from the end-of-game banner.
- Deleted the obsolete banner button handler and all dedicated styling.
- Kept **Match Setup** as the only route for changing characters or match mode.


## End-of-game banner cleanup

- Removed the unused **Review Game** button.
- Changed the banner's **New Match** button to immediately restart using the
  current characters, mode, seed, and reading-speed settings.
- The match setup window now opens only from the dedicated **Match Setup** button.


## Phase 5 — Match review

- Enhanced the move timeline with icons and restrained styling for captures,
  checks, castling, promotions, and checkmate.
- Added hover previews that highlight each move's origin and destination squares.
- Added an end-of-game statistical summary.
- Added lightweight match nicknames derived from the game's activity.
- Added a personality-weighted signature move for decisive winners.
- Added no database, persistent memory, dependencies, or deeper engine analysis.


## Phase 4 — Post-match character reactions

- Added winner, loser, and draw presentation states to character cards.
- Winners now use checkmate dialogue and expressions.
- Losers now use losing dialogue and expressions.
- Draws now give both characters their draw reactions.
- Added a visible winner badge and subtle loser dimming.
- Rewinding the final move restores the normal review state.
- Added no new character fields, dependencies, or timing systems.


## Phase 3 — Match result banner

- Added a prominent result banner above the board.
- Checkmate results display the winner's name, side, theme colors, and move count.
- Draw results display a neutral banner and the detected draw reason.
- Added `Review Game` and `New Match` actions.
- The banner automatically clears when starting or rewinding a match.
- Added no new dependencies or compatibility systems.


## Phase 2 — Lightweight personality feedback

- Split move scoring into `chessScore()` and `personalityScore()`.
- Added one temporary mood per character.
- Mood reacts to openings, captures, checks, advantage, disadvantage, draws,
  and checkmate.
- The active character's dialogue and portrait now follow their mood.
- The opponent's portrait reacts to captures and checks.
- Added a brief mood message to the match status.
- Did not add thinking speed or any second timing system.
- Added no new files, dependencies, frameworks, or compatibility code.


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
