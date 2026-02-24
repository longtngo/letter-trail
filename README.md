# Letter Trail

A word puzzle game where players must find words that contain a generated letter sequence in order.

## Quick Start

`http-server` is required for loading `data/*` files.

1. Verify Node.js is installed:

```bash
node -v
```

2. Run `http-server` on port `3000` (no install needed):

```bash
npx --yes http-server . -p 3000
```

3. Open:

- <http://127.0.0.1:3000/index.html>

Optional: install globally if you prefer:

```bash
npm install -g http-server
http-server . -p 3000
```

You can also host the folder on GitHub Pages or any static host.

## Game Rules

1. The game generates a random letter sequence.
2. You must enter a valid word/name that contains all letters in that exact order.
3. Score is based on Scrabble letter points plus a length bonus.
4. You can submit unlimited guesses.
5. Wrong guesses are tracked and show fuzzy-match closeness as a percentage.
6. `Show All Solutions` reveals all valid answers and meanings.
7. After revealing all solutions, input is locked until `New Game`.

## Features

- Theme selection:
  - English dictionary
  - Pokemon names
  - Country names
  - Capital city names
- Default letter count: `4` (selectable `2` to `6`)
- User preference persistence:
  - Selected theme and letter count are stored in `localStorage` (`letterTrailPrefs:v1`)
- Live tile feedback:
  - Matching letters turn green as you type
  - Submit is enabled only when all letters are matched in order
- Guess-result feedback:
  - Input border + icon only (`✓` accepted, `✕` rejected)
  - Wrong guesses still show fuzzy similarity in the Wrong Words list (`XX% matched`)
- Wrong guess feedback:
  - Highest fuzzy similarity to any solution (e.g. `72% matched`)
- Cached datasets in `localStorage` with 7-day TTL
- Dictionary fallback validation:
  - Uses local 65k dictionary first
  - If a dictionary word is not found locally, it checks Dictionary API and caches valid misses
- Responsive layout (desktop + mobile)

## Data Sources

- Local static datasets:
  - `data/english_65k.txt`
  - `data/countries_un_observers.json`
  - `data/capitals_un_observers.json`
- Pokemon names:
  - <https://pokeapi.co/api/v2/pokemon?limit=2000>
- Dictionary meanings fallback:
  - <https://api.dictionaryapi.dev/>

## Country Dataset Scope

- Country list uses a sovereign-focused set:
  - Includes `independent=true`
  - Excludes `XK` (Kosovo)
  - Includes `PS` (Palestine)
- This avoids territory-style entries such as Antarctica in country mode.

## Project Files

- `index.html`: game markup
- `styles.css`: game styles
- `script.js`: game logic and interactions
- `data/english_65k.txt`: stable local English dictionary (65,000 words)
- `data/countries_un_observers.json`: curated country dataset
- `data/capitals_un_observers.json`: curated capital city dataset
- `README.md`: project documentation

## Notes

- Opening `index.html` via `file://` can fail because browsers block local `fetch()` for dataset files.
- First load can take longer while datasets are loaded and cached.
- If network requests fail for online checks, use `New Game` to retry.
