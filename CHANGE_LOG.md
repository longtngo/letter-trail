# Change Log

## 2026-02-24
### Release: `eb685ea` (since `592a442`)

#### Data quality and reliability
- Added bundled static datasets:
  - `data/english_65k.txt`
  - `data/countries_un_observers.json`
  - `data/capitals_un_observers.json`
- Switched from fragile runtime-only sources to local data-first loading.
- Improved country/capital quality by using curated sovereign-focused lists.
- Added dictionary miss fallback validation via Dictionary API with caching.

#### Gameplay and settings
- Changed default letter count from `3` to `4`.
- Added game mode selection:
  - `Standard`
  - `Easy (consecutive letters)`
- Easy mode now generates consecutive target letters from the seed word.
- Persisted user preferences in `localStorage`:
  - Theme
  - Letter count
  - Mode

#### UI and UX
- Moved theme/letter/mode controls into the side settings panel.
- Replaced inline dropdown sentence with plain rule text.
- Added input-state feedback styling for accepted/rejected guesses.
- Improved mobile layout spacing and component alignment:
  - Rule + tiles spacing
  - Input/button height consistency
  - Feedback icon vertical centering

#### Frontend structure
- Split inline assets out of `index.html`:
  - `styles.css` for styling
  - `script.js` for game logic
- Kept `index.html` as markup-only shell.

#### Documentation
- Updated README with:
  - `http-server` local run instructions
  - New file structure
  - Data strategy and behavior notes

## 2026-02-22
### Release: `592a442` (since `f87b1a1`)

#### Project cleanup and structure
- Removed design exploration files to keep only the production game surface.
- Consolidated game entrypoint to `index.html` (removed `index2.html`).
- Updated repository docs to match the simplified project structure.

#### UI and copy polish
- Updated subtitle copy for the main game screen.

#### Code quality
- Refactored `index.html` script to reduce duplication and improve maintainability.
- Kept behavior consistent while simplifying internal code paths.
