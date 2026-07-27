# Engine Architecture — Phase 13.1

## Authoritative chess engine

Stockfish 18 is the only move-analysis engine. It supplies MultiPV candidates and objective evaluations.

`chess.js` is not an AI engine in this project. It maintains the board, validates legal moves, records history, and detects game-ending conditions.

## Request path

```text
Run / Next Move
      ↓
requestAiMove()
      ↓
StockfishManager queue
      ↓
Stockfish MultiPV analysis
      ↓
Character preference scoring
      ↓
Validated move applied through chess.js
```

Only `StockfishManager` sends UCI `go` commands. It serializes requests so Stockfish never receives overlapping searches.

## Stale-result protection

Every AI request records the current match generation and FEN. If a match is reset, rewound, or otherwise changed before analysis completes, that result is discarded and cannot update the board.

## Explicitly absent

- custom minimax or alpha-beta search
- custom board evaluator
- alternative candidate generator
- random legal-move fallback
- backwards-compatibility engine path
