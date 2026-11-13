#!/usr/bin/env python3
"""
Builds web/data/masters.json: puzzles mined from famous master games.

Runs on GitHub's build server. It downloads player game collections
(PGN, historical games — game moves are facts, not copyrighted),
replays each game with Stockfish, and keeps the moments where the master
punished a mistake with a clear, unique winning move. Every puzzle keeps
its players and year so the app can tell its story.

Output: a JSON list of [id, fen, moves, rating, themes, meta]
  fen   = position BEFORE the opponent's mistake
  moves = UCI moves: opponent's mistake, then the solution (engine-checked)
  meta  = "White|Black|Year|Event"
Usage: build_masters.py OUT.json [--engine PATH] [--pgn FILE ...] [--per-player N]
"""
import argparse
import hashlib
import io
import json
import multiprocessing as mp
import os
import random
import re
import sys
import time
import urllib.request
import zipfile

import chess
import chess.engine
import chess.pgn

# Each entry: alternative file names to try for that player's collection
PLAYERS = [
    ["Anderssen"], ["Morphy"], ["Steinitz"], ["Chigorin", "Tchigorin"], ["Pillsbury"],
    ["Lasker", "LaskerE"], ["Tarrasch"], ["Marshall"], ["Rubinstein"], ["Capablanca"],
    ["Alekhine"], ["Nimzowitsch", "Nimzovich"], ["Spielmann"], ["Euwe"], ["Botvinnik"],
    ["Keres"], ["Smyslov"], ["Bronstein"], ["Tal"], ["Petrosian"], ["Spassky"], ["Fischer"],
    ["Larsen"], ["Korchnoi"], ["Karpov"], ["Kasparov"], ["PolgarJ", "Polgar"], ["Anand"],
    ["Kramnik"], ["Shirov"],
]
URL = "https://www.pgnmentor.com/players/{}.zip"
VAL = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}

QUICK = chess.engine.Limit(nodes=60000)
DEEP = chess.engine.Limit(nodes=1500000)


def download(player):
    req = urllib.request.Request(URL.format(player), headers={"User-Agent": "Mozilla/5.0 johns-gambit-build"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    z = zipfile.ZipFile(io.BytesIO(data))
    texts = []
    for n in z.namelist():
        if n.lower().endswith(".pgn"):
            texts.append(z.read(n).decode("latin-1"))
    return "\n\n".join(texts)


def games_from_text(text, limit, player):
    pgn = io.StringIO(text)
    out = []
    while True:
        try:
            g = chess.pgn.read_game(pgn)
        except Exception:
            continue
        if g is None:
            break
        res = g.headers.get("Result", "*")
        if res not in ("1-0", "0-1"):
            continue
        if g.headers.get("FEN") or g.headers.get("SetUp") == "1":
            continue
        out.append(g)
    random.Random(player).shuffle(out)
    return out[:limit]


def surname(name):
    name = (name or "?").strip()
    return name.split(",")[0].strip() if "," in name else name.split(" ")[-1]


def score_cp(info, pov):
    s = info["score"].pov(pov)
    if s.is_mate():
        m = s.mate()
        return 10000 - abs(m) if m > 0 else -10000 + abs(m)
    return s.score()


def material(board, color):
    return sum(VAL[p.piece_type] for p in board.piece_map().values() if p.color == color)


def classify(start, moves, solver):
    """Theme tags (same names the app uses) for a puzzle line."""
    b = start.copy()
    b.push(moves[0])
    tags = set()
    first = moves[1]
    mover = b.piece_at(first.from_square)
    captured = b.piece_at(first.to_square)
    pinned_before = {sq for sq in chess.SQUARES if b.piece_at(sq) and b.piece_at(sq).color != solver and b.is_pinned(not solver, sq)}
    defended = b.is_attacked_by(not solver, first.to_square)
    if captured and not b.attackers(not solver, first.to_square) and VAL[captured.piece_type] >= 3:
        tags.add("hangingPiece")
    b.push(first)
    if b.is_check() and len(b.checkers()) >= 2:
        tags.add("doubleCheck")
    if b.is_check() and first.to_square not in b.checkers():
        tags.add("discoveredAttack")
    # fork: the moved piece hits two valuable targets
    targets = [sq for sq in b.attacks(first.to_square)
               if b.piece_at(sq) and b.piece_at(sq).color != solver
               and (b.piece_at(sq).piece_type == chess.KING or VAL[b.piece_at(sq).piece_type] > VAL[mover.piece_type]
                    or (VAL[b.piece_at(sq).piece_type] >= 3 and not b.attackers(not solver, sq)))]
    if len(targets) >= 2:
        tags.add("fork")
    # new pins
    for sq in chess.SQUARES:
        p = b.piece_at(sq)
        if p and p.color != solver and p.piece_type != chess.KING and sq not in pinned_before and b.is_pinned(not solver, sq):
            tags.add("pin")
            break
    # skewer: slider attacks king/queen with a lesser piece behind it on the same line
    if mover.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
        for sq in b.attacks(first.to_square):
            p = b.piece_at(sq)
            if p and p.color != solver and p.piece_type in (chess.KING, chess.QUEEN):
                ray = chess.ray(first.to_square, sq)
                beyond = [s for s in chess.SquareSet(ray) if chess.square_distance(first.to_square, s) > chess.square_distance(first.to_square, sq)
                          and chess.SquareSet(chess.between(first.to_square, s)).issuperset(chess.SquareSet(chess.between(first.to_square, sq)))]
                beyond.sort(key=lambda s: chess.square_distance(sq, s))
                for s in beyond:
                    q = b.piece_at(s)
                    if q:
                        if q.color != solver and VAL[q.piece_type] < VAL[p.piece_type] + (9 if p.piece_type == chess.KING else 0) and q.piece_type != chess.PAWN:
                            tags.add("skewer")
                        break
    if (not captured or VAL[captured.piece_type] < VAL[mover.piece_type]) and defended and mover.piece_type != chess.PAWN:
        tags.add("sacrifice")
    if not captured and not b.is_check():
        tags.add("quietMove")
    for m in moves[2:]:
        b.push(m)
    if any(m.promotion for m in moves[1::2]):
        tags.add("promotion")
    solver_moves = len(moves[1::2])
    if b.is_checkmate():
        tags.add("mate")
        tags.add({1: "mateIn1", 2: "mateIn2", 3: "mateIn3"}.get(solver_moves, "mateIn4"))
        king = b.king(not solver)
        back = 0 if not solver == chess.WHITE else 7
        rank_k = chess.square_rank(king)
        last = moves[-1]
        lp = b.piece_at(last.to_square)
        if rank_k in (0, 7) and lp and lp.piece_type in (chess.ROOK, chess.QUEEN) and chess.square_rank(last.to_square) == rank_k:
            tags.add("backRankMate")
        if lp and lp.piece_type == chess.KNIGHT:
            around = [s for s in chess.SquareSet(chess.BB_KING_ATTACKS[king])]
            if all(b.piece_at(s) and b.piece_at(s).color == (not solver) for s in around):
                tags.add("smotheredMate")
    pieces = [p for p in start.piece_map().values() if p.piece_type not in (chess.KING, chess.PAWN)]
    nonpawn = sum(VAL[p.piece_type] for p in pieces)
    if nonpawn <= 14:
        tags.add("endgame")
        kinds = {p.piece_type for p in pieces}
        if not kinds:
            tags.add("pawnEndgame")
        elif kinds == {chess.ROOK}:
            tags.add("rookEndgame")
        elif kinds == {chess.QUEEN}:
            tags.add("queenEndgame")
        elif kinds == {chess.BISHOP}:
            tags.add("bishopEndgame")
        elif kinds == {chess.KNIGHT}:
            tags.add("knightEndgame")
    elif start.fullmove_number <= 14:
        tags.add("opening")
    else:
        tags.add("middlegame")
    if solver_moves == 1:
        tags.add("oneMove")
    elif solver_moves == 2:
        tags.add("short")
    else:
        tags.add("long")
    tags.add("master")
    return sorted(tags)


def estimate_rating(tags, solver_moves):
    r = 1000 + 220 * (solver_moves - 1)
    if "sacrifice" in tags:
        r += 250
    if "quietMove" in tags:
        r += 200
    if "mateIn1" in tags:
        r -= 250
    if "hangingPiece" in tags:
        r -= 200
    if "endgame" in tags:
        r += 80
    return max(500, min(2500, r))


def unique_best(engine, board):
    """(best_move, best_cp, is_unique) from the side to move's view."""
    infos = engine.analyse(board, DEEP, multipv=2)
    best = infos[0]
    bcp = score_cp(best, board.turn)
    if len(infos) < 2:
        return best["pv"][0], bcp, True
    scp = score_cp(infos[1], board.turn)
    mate_best = best["score"].pov(board.turn).is_mate() and best["score"].pov(board.turn).mate() > 0
    mate_second = infos[1]["score"].pov(board.turn).is_mate() and infos[1]["score"].pov(board.turn).mate() > 0
    if mate_best and not mate_second:
        return best["pv"][0], bcp, True
    if mate_best and mate_second:
        # both mate: only unique if the second is much slower
        return best["pv"][0], bcp, best["score"].pov(board.turn).mate() + 2 <= infos[1]["score"].pov(board.turn).mate()
    return best["pv"][0], bcp, (bcp - scp) >= 220 and bcp >= 200


def mine_game(engine, game):
    found = []
    board = game.board()
    moves = list(game.mainline_moves())
    if len(moves) < 16:
        return found
    # quick evals of every position (side-to-move view)
    evals = []
    b = board.copy()
    for m in moves:
        evals.append(score_cp(engine.analyse(b, QUICK), b.turn))
        b.push(m)
    b = board.copy()
    positions = []
    for m in moves:
        positions.append(b.copy())
        b.push(m)
    used_upto = -1
    for k in range(10, len(moves) - 1):
        if k <= used_upto:
            continue
        # position k: solver to move after opponent's move k-1
        before = -evals[k - 1]   # solver's view before the opponent moved
        after = evals[k]          # solver's view after the opponent's move
        if before > 150 or before < -300 or after < 150 or after - before < 150:
            continue
        pos = positions[k]
        best, bcp, uniq = unique_best(engine, pos)
        if not uniq or best != moves[k]:
            continue
        solver = pos.turn
        line = [moves[k - 1], best]
        cur = pos.copy()
        cur.push(best)
        start_mat = material(positions[k - 1], solver) - material(positions[k - 1], not solver)
        for _ in range(4):
            if cur.is_game_over():
                break
            gain = (material(cur, solver) - material(cur, not solver)) - start_mat
            if gain >= 2 and not cur.is_check():
                # stop once material is won and the opponent has no immediate recapture of note
                rep = engine.analyse(cur, QUICK)
                if score_cp(rep, solver) >= 300 and gain >= 2:
                    break
            reply = engine.analyse(cur, QUICK)["pv"][0]
            cur.push(reply)
            if cur.is_game_over():
                cur.pop()
                break
            nb, ncp, nuniq = unique_best(engine, cur)
            if not nuniq:
                cur.pop()
                break
            line += [reply, nb]
            cur.push(nb)
        # the line must actually win something or mate
        end_gain = (material(cur, solver) - material(cur, not solver)) - start_mat
        if not (cur.is_checkmate() or end_gain >= 2 or bcp >= 9000):
            continue
        tags = classify(positions[k - 1], line, solver)
        if bcp >= 9000 and 'mate' not in tags:
            tags = sorted(set(tags) | {'mate', 'exposedKing'})
        rating = estimate_rating(tags, len(line[1::2]))
        h = game.headers
        year = (h.get("Date", "????")[:4]).replace("?", "") or "?"
        meta = f"{surname(h.get('White'))}|{surname(h.get('Black'))}|{year}|{h.get('Event', '').strip()[:40]}"
        pid = "m" + hashlib.md5((positions[k - 1].fen() + line[0].uci()).encode()).hexdigest()[:7]
        found.append([pid, positions[k - 1].fen(), " ".join(m.uci() for m in line), rating, " ".join(tags), meta])
        used_upto = k + len(line)
    return found


def worker_batch(args):
    engine_path, texts, deadline = args
    engine = chess.engine.SimpleEngine.popen_uci(engine_path)
    try:
        engine.configure({"Threads": 1, "Hash": 32})
    except Exception:
        pass
    out = []
    for t in texts:
        if time.time() > deadline:
            break
        try:
            g = chess.pgn.read_game(io.StringIO(t))
            if g:
                out += mine_game(engine, g)
        except Exception as e:
            print("  skipped a game:", e, flush=True)
    engine.quit()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--engine", default="stockfish")
    ap.add_argument("--pgn", nargs="*")
    ap.add_argument("--per-player", type=int, default=120)
    ap.add_argument("--procs", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--minutes", type=float, default=75, help="time budget for mining")
    a = ap.parse_args()

    games = []
    if a.pgn:
        for f in a.pgn:
            games += games_from_text(open(f, encoding="latin-1").read(), 10 ** 6, f)
    else:
        for names in PLAYERS:
            for p in names:
                try:
                    text = download(p)
                    gs = games_from_text(text, a.per_player, p)
                    print(f"{p}: {len(gs)} games", flush=True)
                    games += gs
                    break
                except Exception as e:
                    print(f"{p}: download failed ({e})", flush=True)
    # de-duplicate games that appear in two players' collections
    seen, uniq = set(), []
    for g in games:
        key = (g.headers.get("White"), g.headers.get("Black"), g.headers.get("Date"), len(list(g.mainline_moves())))
        if key not in seen:
            seen.add(key)
            uniq.append(g)
    texts = [str(g) for g in uniq]
    print(f"Mining {len(texts)} games with {a.procs} engines...", flush=True)
    random.Random(7).shuffle(texts)  # mix players so a time cut-off still covers everyone
    deadline = time.time() + a.minutes * 60
    chunks = [texts[i::a.procs] for i in range(a.procs)]
    results = []
    with mp.Pool(a.procs) as pool:
        for i, r in enumerate(pool.imap_unordered(worker_batch, [(a.engine, c, deadline) for c in chunks])):
            results += r
            print(f"  batch {i + 1}/{len(chunks)} done, {len(results)} puzzles so far", flush=True)
    by_id = {r[0]: r for r in results}
    data = sorted(by_id.values(), key=lambda x: x[3])
    with open(a.out, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Kept {len(data)} master puzzles -> {a.out}")
    if not a.pgn and len(data) < 300:
        sys.exit("Too few master puzzles; downloads probably failed.")


if __name__ == "__main__":
    main()
