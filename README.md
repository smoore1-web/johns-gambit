# John's Gambit

A personal, fully offline chess trainer for Android, styled like an old RPG.

- **Puzzle Forest** – rated puzzles with 3-level hints, blindfold mode and "why" explanations that grow with your rating
- **Tactics Village** – train one theme at a time; the weakness tracker marks your weak themes
- **Opening Peaks** – opening course (stories, ideas, traps, counters), repertoire drills with random opponent replies, out-of-book practice vs Stockfish, tree view, trap trainer, guess the move, name that opening, opening finder, pawn structures, beginner principles
- **Endgame Castle** – key endgames vs Stockfish: win them or hold the draw
- **Rush Arena** – 3 or 5 minute puzzle rush
- **Base Camp** – optional daily quest mixing reviews and new material
- Spaced repetition everywhere: anything you miss comes back sooner

## Getting the app

Every push to `main` builds the APK on GitHub Actions. Download `JohnsGambit.apk` from the
**Releases → latest** page (or the run's artifacts) on your phone and install it.

## Layout

- `web/` – the game (HTML/CSS/JS). Open `web/index.html` through any local web server to play in a browser.
- `android/` – a small WebView shell that bundles `web/` offline.
- `scripts/build_puzzles.py` – picks ~10,000 puzzles from the Lichess puzzle database during the build.

Credits: puzzles from the Lichess puzzle database (CC0); openings list from lichess-org/chess-openings (CC0);
Stockfish.js (GPLv3); chess.js (BSD-2); fonts Press Start 2P and VT323 (OFL).
