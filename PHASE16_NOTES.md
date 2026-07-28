# Phase 16 — Emotional State

Phase 16 adds a runtime emotional-state layer without adding new character JSON fields.

Each character receives three changing values during a match:

- **Confidence** — affects aggression, risk tolerance, impulsiveness, and best-move discipline.
- **Frustration** — reduces consistency, awareness, defensive accuracy, and composure while increasing impulsiveness.
- **Focus** — improves candidate awareness, calculation, tactical awareness, threat awareness, and evaluation accuracy.

The initial values and emotional inertia are derived entirely from existing `skill` and `decision` values. High-composure, consistent characters change slowly. More impulsive or inconsistent characters react more strongly.

Runtime triggers include:

- sound moves, inaccuracies, mistakes, and blunders;
- winning or losing material;
- giving or receiving check;
- gradual recovery toward the character's baseline.

The emotion engine modifies the effective chess brain used by move awareness, search budget, evaluation noise, style scoring, and mistake selection. It does not replace or duplicate the original profile.

AI Diagnostics now displays current confidence, frustration, focus, and the latest emotional trigger.
