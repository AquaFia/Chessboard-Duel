# Phase 15 Notes

## Decision pipeline

1. Generate every legal move.
2. Use candidate awareness, tactical awareness, threat awareness, development style, piece activity, king safety, and piece preferences to determine which legal moves the character notices.
3. Ask Stockfish to evaluate only those noticed moves with `searchmoves`.
4. Obtain one separate objective benchmark move.
5. Apply perception, style, error tier, consistency, and piece preference to the noticed candidates.
6. Commit exactly one move through the turn-integrity guard.

`piecePreferences` remains gameplay-only data. No decorative favorite-piece fields were introduced.
