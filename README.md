# Letter Trail

A word puzzle game where players must find words that contain a generated letter sequence in order.

The project includes:

- A fully functional game UI (`index.html`)

## Quick Start

Open `/index.html` directly in your browser.

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
- Letter count selection: 2 to 6
- Live tile feedback:
  - Matching letters turn green as you type
  - Submit is enabled only when all letters are matched in order
- Wrong guess feedback:
  - Highest fuzzy similarity to any solution (e.g. `72% matched`)
- Cached datasets in `localStorage` with 7-day TTL
- Responsive layout (desktop + mobile)

## Data Sources

- English word list:
  - <https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt>
- Pokemon names:
  - <https://pokeapi.co/api/v2/pokemon?limit=2000>
- Countries/capitals:
  - <https://restcountries.com/v3.1/all?fields=name,capital>
- Dictionary meanings fallback:
  - <https://api.dictionaryapi.dev/>

## Project Files

- `index.html`: current functional game
- `README.md`: project documentation

## Notes

- First load can take longer because theme data is fetched and cached.
- If network requests fail, use `New Game` to retry.
