# Phase 13.2 Code Audit

## White-side winning bug

The Stockfish score was being negated whenever Black was to move:

```js
const objective = side === "w" ? entry.score : -entry.score;
```

Stockfish UCI analysis scores are already expressed from the current side-to-move perspective. Negating Black's score reversed Black's candidate rankings, causing Black to prefer objectively worse moves. The corrected code uses:

```js
const objective = entry.score;
```

## Dead-code audit

The runtime was checked for:

- unreferenced named functions
- single-use declarations that were never consumed
- duplicate Stockfish search entry points
- alternate/custom chess search or evaluation engines
- legacy minimax, alpha-beta, and custom legal-move selection paths
- direct `go` calls outside `StockfishManager`

Results:

- No unreferenced named functions were found.
- No unused top-level declarations were found.
- `StockfishManager` remains the sole Stockfish search gateway.
- No homemade chess engine, minimax, alpha-beta, or fallback move engine is present.
- `chess.js` remains responsible only for board state, legality, history, and game-over rules.

## Character profile note

Several character JSON fields are loaded but do not yet meaningfully affect move selection. Those are data/schema issues reserved for the next character-profile wiring and rebalance phase. They were not silently deleted in this engine-correction phase.
