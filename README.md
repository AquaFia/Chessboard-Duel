# Cipherboard Duel

A portable, static character-driven chess project.

## Project layout

```text
index.html
app.css
app.js
characters/
    characters.json
    jace.json
    juno.json
assets/
README.md
```

There is no `.github` folder, no GitHub Action, and no generated `catalog.json`.

## Adding a character

1. Add the character file, such as `characters/alice.json`.
2. Add its filename to `characters/characters.json`.
3. Add any expression images to `assets/` and reference them from the character JSON.

Example roster:

```json
{
  "characters": [
    "jace.json",
    "juno.json",
    "alice.json"
  ]
}
```

The project works on GitHub Pages or any ordinary static web host. For local use, run a small local server instead of opening `index.html` directly:

```bash
python -m http.server
```

Then open `http://localhost:8000`.

## Expressions

Every portrait filename is assigned to a specific expression. The app only uses that image for that expression.

When the requested expression has no supplied image, the app displays a generated stylized portrait with the correct expression. It does not reuse an unrelated real portrait.

Dialogue events select expressions through `expressionMap`, so you can change a character's reactions entirely from their JSON file.
