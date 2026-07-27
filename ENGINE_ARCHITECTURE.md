# Engine Architecture — Phase 13.0

## Authoritative chess engine

Stockfish 18 is the only chess engine used for AI move analysis and ranking.

The application requests MultiPV analysis from Stockfish and receives objective candidate evaluations. Character JSON data may adjust which Stockfish-approved candidate is preferred, within a skill-derived centipawn tolerance.

## Retained non-engine chess dependency

`chess.js` remains the board rules/state library. It validates legal moves, applies moves, tracks FEN/history, and detects game-over conditions. It does not evaluate positions or choose AI moves.

## Removed systems

- handcrafted material/mobility evaluator
- custom minimax search
- alpha-beta search
- custom candidate discovery engine
- custom threat-search implementation
- custom positional scoring engine
- fallback AI move engine

There is deliberately no compatibility path to the removed engine. When Stockfish cannot initialize or analyze, the match pauses and shows an explicit failure instead of silently switching engines.

## Opening behavior

Each character retains authored white and black opening lines plus `freeformWeight`. A chosen valid book move is played directly. Once the character leaves or exhausts the authored line, Stockfish MultiPV analysis becomes authoritative.
