#!/usr/bin/env python3
"""
Builds web/data/puzzles.json from the free Lichess puzzle database (CC0).

Runs on GitHub's build server (it downloads ~250 MB). Picks well-tested,
popular puzzles spread across ratings and tactical themes, so the app has
plenty for every section while staying small enough to bundle offline.

Output: a JSON list of [id, fen, moves, rating, themes]
  fen   = position BEFORE the opponent's move
  moves = UCI moves; the first is the opponent's move, the rest are the solution
"""
import csv
import io
import json
import random
import sys
import urllib.request

import zstandard

URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
OUT = sys.argv[1] if len(sys.argv) > 1 else "web/data/puzzles.json"
random.seed(2026)

# Themes the app trains directly (Tactics Village, weakness tracker, endgames).
FOCUS = [
    "fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "hangingPiece",
    "backRankMate", "smotheredMate", "mateIn1", "mateIn2", "mateIn3",
    "deflection", "attraction", "decoy", "sacrifice", "clearance", "interference",
    "xRayAttack", "trappedPiece", "zugzwang", "promotion", "advancedPawn",
    "capturingDefender", "intermezzo", "quietMove", "defensiveMove",
    "rookEndgame", "pawnEndgame", "queenEndgame", "bishopEndgame", "knightEndgame",
    "exposedKing", "kingsideAttack", "queensideAttack", "attackingF2F7",
    "anastasiaMate", "arabianMate", "bodenMate", "doubleBishopMate", "hookMate",
    "dovetailMate", "enPassant", "underPromotion", "castling",
]
PER_BAND = 260        # general puzzles per 100-point rating band
PER_THEME = 160       # extra puzzles guaranteed per focus theme
MIN_RATING, MAX_RATING = 400, 2900


def rows():
    print("Downloading Lichess puzzle database...", flush=True)
    req = urllib.request.Request(URL, headers={"User-Agent": "johns-gambit-build"})
    with urllib.request.urlopen(req) as resp:
        dctx = zstandard.ZstdDecompressor()
        with dctx.stream_reader(resp) as reader:
            text = io.TextIOWrapper(reader, encoding="utf-8")
            yield from csv.DictReader(text)


def main():
    bands = {}   # band -> reservoir list
    themes = {t: [] for t in FOCUS}
    seen_counts = {}
    n = 0
    for r in rows():
        n += 1
        if n % 500000 == 0:
            print(f"  read {n:,} puzzles", flush=True)
        try:
            rating = int(r["Rating"])
            pop = int(r["Popularity"])
            plays = int(r["NbPlays"])
            dev = int(r["RatingDeviation"])
        except (ValueError, KeyError):
            continue
        if pop < 85 or plays < 300 or dev > 95:
            continue
        if not (MIN_RATING <= rating <= MAX_RATING):
            continue
        moves = r["Moves"].split()
        if len(moves) < 2 or len(moves) > 12:
            continue
        item = [r["PuzzleId"], r["FEN"], r["Moves"], rating, r["Themes"]]

        # Reservoir sample per rating band
        band = rating // 100
        res = bands.setdefault(band, [])
        seen_counts[band] = seen_counts.get(band, 0) + 1
        k = seen_counts[band]
        if len(res) < PER_BAND:
            res.append(item)
        else:
            j = random.randrange(k)
            if j < PER_BAND:
                res[j] = item

        # Reservoir sample per focus theme
        for t in r["Themes"].split():
            if t in themes:
                key = "t_" + t
                seen_counts[key] = seen_counts.get(key, 0) + 1
                lst = themes[t]
                if len(lst) < PER_THEME:
                    lst.append(item)
                else:
                    j = random.randrange(seen_counts[key])
                    if j < PER_THEME:
                        lst[j] = item

    out = {}
    for lst in list(bands.values()) + list(themes.values()):
        for it in lst:
            out[it[0]] = it
    data = sorted(out.values(), key=lambda x: x[3])
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Read {n:,} puzzles, kept {len(data):,} -> {OUT}")
    if len(data) < 1000:
        sys.exit("Too few puzzles selected; something went wrong.")


if __name__ == "__main__":
    main()
