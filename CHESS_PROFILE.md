# Chess Profile Runtime Contract

The character JSON contains only chess values that alter gameplay.

## Selection pipeline

1. An authored opening line may provide the move.
2. Stockfish 18 analyzes the position with MultiPV.
3. `skill` determines the analysis budget and how accurately candidates are perceived.
4. `style` assigns bounded preferences to viable candidates.
5. `decision` determines objective-loss tolerance, plan continuity, consistency, and lapses.
6. Mate candidates and stale-position safeguards remain authoritative.

## Sections

### `skill`
`candidateAwareness`, `calculation`, `evaluationAccuracy`, `tacticalAwareness`, `threatAwareness`, `positionalUnderstanding`, `openingKnowledge`, `middlegameKnowledge`, `endgameKnowledge`, `conversion`, `defensiveAccuracy`, `practicalConsistency`, `timeManagement`.

### `style`
`aggression`, `riskTolerance`, `initiative`, `complication`, `simplification`, `positionalPreference`, `defensivePreference`, `materialPreference`, `sacrificePreference`, `kingSafety`, `developmentPreference`, `pieceActivity`, `pawnPlay`, `queenActivity`, `endgamePreference`, `novelty`.

### `decision`
`bestMoveDiscipline`, `scoreTolerance`, `intuitionReliance`, `planCommitment`, `planFlexibility`, `confidence`, `composure`, `adaptability`, `impulsiveness`, `overthinking`.

All values are required and must be numbers from 0 through 100. Unknown fields are rejected so obsolete JSON cannot silently remain.
