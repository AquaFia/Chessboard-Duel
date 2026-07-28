# Chess Profile Runtime Schema

Every character must include a `chessProfile` object with these required sections:

- `estimatedElo`
- `skill`
- `style`
- `decision`
- `piecePreferences`

All score values are numbers from 0 through 100. The game rejects missing, unknown, or out-of-range fields.

## Piece preferences

```json
"piecePreferences": {
  "pawn": 50,
  "knight": 50,
  "bishop": 50,
  "rook": 50,
  "queen": 50,
  "king": 50
}
```

These are runtime move-selection weights, not biography or display metadata. A value above 50 rewards moves made by that piece; a value below 50 discourages them. The adjustment is deliberately limited so it breaks close decisions without replacing objective evaluation or the human-error model.

## Human-error behavior

The runtime derives analysis depth, candidate breadth, noticed moves, and error probability from the profile. Low-rated characters can fail to notice good moves and may select inaccuracies, mistakes, or blunders. High-rated characters use deeper searches, notice more candidates, and make fewer severe errors.

Characters explicitly described as not knowing chess should use no prepared opening lines:

```json
"openingProfile": {
  "white": { "freeformWeight": 100, "lines": [] },
  "black": { "freeformWeight": 100, "lines": [] }
}
```
