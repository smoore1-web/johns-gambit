// Puzzle Forest, Tactics Village and Rush Arena, plus the shared puzzle player.
import { h, win, menu, cmd, register, go, back, sfx, toast } from './ui.js';
import { Board } from './board.js';
import { Chess } from './vendor/chess.js';
import * as S from './store.js';
import * as D from './data.js';
import { explain, hints, levelFor, THEME_LABEL, mainTheme } from './explain.js';

export const TACTIC_THEMES = ['fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'hangingPiece',
  'backRankMate', 'smotheredMate', 'mateIn1', 'mateIn2', 'mateIn3', 'deflection', 'attraction',
  'sacrifice', 'clearance', 'interference', 'xRayAttack', 'trappedPiece', 'capturingDefender',
  'intermezzo', 'quietMove', 'defensiveMove', 'promotion', 'advancedPawn', 'zugzwang', 'attackingF2F7',
  'exposedKing', 'anastasiaMate', 'arabianMate', 'bodenMate', 'hookMate', 'dovetailMate', 'enPassant', 'underPromotion'];

// ---------- choosing puzzles ----------
export async function pickPuzzle({ theme = null, rating = S.state().rating, exclude = new Set(), weakBias = true } = {}) {
  const all = await D.puzzles();
  let wanted = theme;
  if (!wanted && weakBias && Math.random() < 0.4) {
    const weak = S.weakThemes(TACTIC_THEMES).filter((w) => w.rate < 0.75);
    if (weak.length) wanted = weak[Math.floor(Math.random() * Math.min(3, weak.length))].t;
  }
  let pool = all.filter((p) => !exclude.has(p.id) && (!wanted || p.themes.split(' ').includes(wanted)));
  if (!pool.length && wanted && !theme) pool = all.filter((p) => !exclude.has(p.id));
  const fresh = pool.filter((p) => !S.wasSeen(p.id));
  if (fresh.length) pool = fresh;
  for (const w of [120, 250, 450, 9999]) {
    const near = pool.filter((p) => Math.abs(p.rating - rating) <= w);
    if (near.length) return near[Math.floor(Math.random() * near.length)];
  }
  return pool[0] || all[Math.floor(Math.random() * all.length)];
}

const uciMove = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

// Hints and notes for puzzles you added yourself (the solver moves first)
function ownHints(p) {
  const c = new Chess(p.fen);
  const m = p.moves.split(' ')[0];
  const pc = c.get(m.slice(0, 2));
  const names = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  const t = p.themes ? mainTheme(p.themes.split(' ')) : null;
  return [
    { text: t ? `Theme: ${(THEME_LABEL[t] || t).toUpperCase()}.` : 'Look for checks, captures and threats.' },
    { text: `The ${names[pc.type]} on ${m.slice(0, 2)} makes the key move.` },
    { text: `Move it to ${m.slice(2, 4)}.` },
  ];
}
function ownExplain(p) {
  const c = new Chess(p.fen);
  const sans = p.moves.split(' ').map((u) => c.move(uciMove(u)).san);
  const t = p.themes ? mainTheme(p.themes.split(' ')) : null;
  return { title: t ? (THEME_LABEL[t] || t).toUpperCase() : 'YOUR PUZZLE', text: `Solution: ${sans.join(' ')}.${p.book ? ` (${p.book}${p.page ? ', p.' + p.page : ''})` : ''}` };
}

// ---------- the puzzle player ----------
// opts: { mode: 'rated'|'review'|'theme'|'rush'|'quest', title, onDone(result), onNext, allowHints, quiet }
export function playPuzzle(el, puzzle, opts = {}) {
  const st = S.state();
  const moves = puzzle.moves.split(' ');
  const themes = puzzle.themes.split(' ');
  const solverFirst = !!puzzle.solverFirst;
  const off = solverFirst ? 0 : 1;
  const hintList = solverFirst ? ownHints(puzzle) : hints(puzzle);
  const allowHints = opts.allowHints !== false;
  let idx = off, failed = false, hintsUsed = 0, done = false, blind = !!opts.blind, timers = [];

  const status = h('section', { class: 'window tight status' });
  const msgTitle = h('div', { class: 'title-sm' });
  const msgText = h('p');
  const msg = h('section', { class: 'window msg' }, msgTitle, msgText);
  const boardEl = h('div');
  const cmds = h('nav', { class: 'window cmds' });
  el.append(status, msg, boardEl, cmds);
  if (opts.extraTop) el.prepend(opts.extraTop);

  const board = new Board(boardEl, {
    coords: st.settings.coords,
    canMove: (c) => !done && c === board.chess.turn() && (idx - off) % 2 === 0,
    onMove: (uci) => attempt(uci),
  });
  board.load(puzzle.fen);
  const toMove = puzzle.fen.split(' ')[1];
  const me = solverFirst ? toMove : (toMove === 'w' ? 'b' : 'w');
  const st0 = puzzle.story;
  const hero = st0 ? (me === 'w' ? st0.white : st0.black) : null;
  const storyLine = st0 ? `${st0.white} vs ${st0.black}${st0.year ? ', ' + st0.year : ''}` : (puzzle.book ? `${puzzle.book}${puzzle.page ? ', p.' + puzzle.page : ''}` : null);
  board.setOrientation(me);
  board.setBlind(blind);
  board.lock(true);

  function stars() { return allowHints ? '★'.repeat(3 - hintsUsed) + '☆'.repeat(hintsUsed) : ''; }
  function drawStatus() {
    status.innerHTML = '';
    status.append(
      h('span', { class: 'px' }, (opts.title || 'PUZZLE') + (puzzle.source === 'master' && !opts.title?.includes('MASTER') ? ' ♛' : '')),
      opts.mode === 'rush' ? h('span', {}, '') : h('span', {}, `★ ${puzzle.rating}`),
      allowHints ? h('span', { class: 'gold' }, 'HINTS ' + stars()) : h('span', {}, ''));
  }
  function say(title, text, cls) {
    msgTitle.textContent = title; msgText.textContent = text;
    msg.classList.remove('win', 'lose'); if (cls) msg.classList.add(cls);
  }
  function blindText() {
    const l = board.pieceList();
    const last = board.chess.history({ verbose: true }).slice(-1)[0];
    return `White: ${l.w.join(' ')}. Black: ${l.b.join(' ')}.${last ? ` Last move: ${last.san}.` : ''}`;
  }
  function prompt() {
    const side = me === 'w' ? 'WHITE' : 'BLACK';
    if (blind) say(`${side} TO MOVE (BLINDFOLD)`, blindText());
    else if (idx > off) say(`${side} TO MOVE`, 'Good! Keep going…');
    else if (hero) say(`${side} TO MOVE`, `${storyLine}. Find ${hero}'s move!`);
    else if (storyLine) say(`${side} TO MOVE`, `From ${storyLine}. Find the best move!`);
    else say(`${side} TO MOVE`, 'Find the best move! Tap a piece, then its square.');
  }
  function drawCmds() {
    cmds.innerHTML = '';
    if (!done) {
      if (allowHints) cmds.append(cmd('HINT', useHint, { disabled: hintsUsed >= 3 }));
      if (opts.mode !== 'rush') cmds.append(cmd(blind ? 'PIECES ON' : 'BLINDFOLD', toggleBlind));
      if (blind) cmds.append(cmd('PEEK', peek));
      if (opts.mode !== 'rush') cmds.append(cmd(failed ? 'SOLUTION' : 'GIVE UP', showSolution));
      cmds.append(cmd(opts.mode === 'quest' ? 'SKIP' : 'QUIT', () => { if (opts.mode === 'quest') finish(false, true); else back(); }));
    } else {
      if (opts.onNext) cmds.append(cmd('NEXT', opts.onNext));
      if (opts.mode !== 'rush' && opts.mode !== 'quest') cmds.append(cmd('RETRY', () => opts.onRetry ? opts.onRetry() : null));
      if (blind) cmds.append(cmd('SHOW BOARD', () => { blind = false; board.setBlind(false); drawCmds(); }));
      if (opts.mode !== 'quest') cmds.append(cmd('BACK', back));
    }
  }
  function toggleBlind() { blind = !blind; board.setBlind(blind); if (!done) prompt(); drawCmds(); }
  function peek() { board.setBlind(false); timers.push(setTimeout(() => board.setBlind(blind), 1500)); }

  function useHint() {
    if (hintsUsed >= 3 || done) return;
    const hnt = hintList[hintsUsed];
    hintsUsed++;
    // hints apply to the current move: rebuild hints 2/3 for later moves
    const cur = moves[idx];
    if (hintsUsed >= 2) { board.clearMarks(); board.mark(cur.slice(0, 2), 'hint'); }
    if (hintsUsed === 3) { board.clearArrows(); board.arrow(cur.slice(0, 2), cur.slice(2, 4)); }
    const text = idx === off ? hnt.text : (hintsUsed === 1 ? hnt.text : hintsUsed === 2 ? `Move the piece on ${cur.slice(0, 2)}.` : `Move it to ${cur.slice(2, 4)}.`);
    say(`HINT ${hintsUsed}`, text);
    drawStatus(); drawCmds();
  }

  async function attempt(uci) {
    const expected = moves[idx];
    let ok = uci === expected || (uci.slice(0, 4) === expected.slice(0, 4) && !expected[4]);
    if (!ok) {
      // any move that gives checkmate also solves it
      const test = board.chess.move(uciMove(uci));
      if (test) { ok = board.chess.isCheckmate(); board.chess.undo(); }
    }
    if (!ok) {
      failed = true;
      sfx('bad');
      el.querySelector('.board-wrap').classList.add('shake');
      timers.push(setTimeout(() => el.querySelector('.board-wrap')?.classList.remove('shake'), 600));
      say('NOT QUITE…', 'That lets your opponent off the hook. Try again, or tap SOLUTION.', 'lose');
      drawCmds();
      return false;
    }
    const mv = board.play(uci.length === 4 && expected.length === 5 ? expected : uci);
    sfx(mv && mv.captured ? 'capture' : 'move');
    board.clearMarks(); board.clearArrows();
    idx++;
    if (idx >= moves.length || board.chess.isCheckmate()) { finish(!failed); return true; }
    board.lock(true);
    timers.push(setTimeout(() => {
      const r = board.play(moves[idx]); sfx(r && r.captured ? 'capture' : 'move'); idx++;
      board.lock(false); prompt(); drawCmds();
    }, 450));
    return true;
  }

  function showSolution() {
    failed = true; board.lock(true); board.clearMarks(); board.clearArrows();
    const step = () => {
      if (idx >= moves.length) { finish(false); return; }
      board.play(moves[idx]); sfx('move'); idx++;
      timers.push(setTimeout(step, 650));
    };
    step();
  }

  function finish(clean, skipped = false) {
    if (done) return;
    done = true; board.lock(true); board.clearArrows();
    const grade = skipped ? 0 : failed ? 0 : hintsUsed ? 1 : 2;
    const result = { clean: grade === 2, grade, puzzle, hintsUsed, failed, skipped };
    if (opts.mode !== 'rush' && !skipped) {
      S.markSeen(puzzle.id);
      S.review('pz:' + puzzle.id, grade, puzzle.rating);
      S.recordThemes(themes, grade === 2);
      if (opts.mode === 'rated' || opts.mode === 'theme' || opts.mode === 'quest') {
        result.delta = S.ratePuzzle(puzzle.rating, grade === 2 ? 1 : grade === 1 ? 0.3 : 0);
      }
      const rec = st.records;
      if (grade > 0) { rec.solved++; S.addXP(grade === 2 ? 12 : 6); }
      if (grade === 2) { rec.cleanRun++; rec.bestCleanRun = Math.max(rec.bestCleanRun, rec.cleanRun); rec.hardest = Math.max(rec.hardest, puzzle.rating); }
      else rec.cleanRun = 0;
      S.save();
      if (rec.solved === 1 && S.badge('first')) toast('BADGE: FIRST VICTORY!');
      if (rec.solved === 100 && S.badge('hundred')) toast('BADGE: 100 PUZZLES!');
      if (grade === 2 && hintsUsed === 0 && opts.mode !== 'quest') { /* no-help bonus already counted */ }
    }
    if (opts.quiet) { opts.onDone && opts.onDone(result); return; }
    const lvl = levelFor(st.rating, st.settings.explain);
    const why = solverFirst ? ownExplain(puzzle) : explain(puzzle, lvl);
    if (hero) why.text += ` ${hero} played it in ${st0.year || 'the game'}.`;
    if (grade === 2) { sfx('good'); say(`VICTORY! ${why.title}`, why.text + (result.delta != null ? `  (${result.delta >= 0 ? '+' : ''}${result.delta})` : '') + (hintsUsed === 0 ? '  Found without help!' : ''), 'win'); }
    else if (grade === 1) { sfx('good'); say(`SOLVED WITH HELP · ${why.title}`, why.text + ' It will come back sooner for review.', 'win'); }
    else { sfx('bad'); say(`LEARN IT · ${why.title}`, why.text + ' This puzzle will come back soon.', 'lose'); }
    drawCmds();
    opts.onDone && opts.onDone(result);
  }

  drawStatus(); drawCmds();
  if (solverFirst) { board.lock(false); prompt(); }
  else {
    say('GET READY…', storyLine ? `${storyLine}. Watch the move…` : 'Watch your opponent\'s move.');
    timers.push(setTimeout(() => {
      const r = board.play(moves[0]); sfx(r && r.captured ? 'capture' : 'move');
      board.lock(false); prompt(); drawCmds();
    }, 700));
  }
  return { stop: () => timers.forEach(clearTimeout), board };
}

// ---------- Puzzle Forest ----------
register('forest', (el) => {
  const st = S.state();
  const dueN = S.dueCount('pz:');
  el.append(
    win('PUZZLE FOREST', h('p', { class: 'para' }, 'Puzzles from famous master games — find the move the champion played. Each one ends with a "why" note, and any you miss come back for review.')),
    h('section', { class: 'window' }, menu([
      { label: 'NEW PUZZLE', sub: `rating ${st.rating}`, onClick: () => go('puzzle', { mode: 'rated' }) },
      { label: 'REVIEWS', sub: `${dueN} due`, onClick: () => dueN ? go('puzzle', { mode: 'review' }) : toast('NO REVIEWS DUE'), },
      { label: 'BLINDFOLD PUZZLE', sub: 'pieces hidden', onClick: () => go('puzzle', { mode: 'rated', blind: true }) },
      { label: 'MY PUZZLES', sub: `${D.mine().length}`, onClick: () => go('mypuzzles') },
      { label: 'WEAKEST THEME', sub: (S.weakThemes(TACTIC_THEMES)[0] ? THEME_LABEL[S.weakThemes(TACTIC_THEMES)[0].t] : 'needs data'), onClick: () => { const w = S.weakThemes(TACTIC_THEMES)[0]; w ? go('puzzle', { mode: 'theme', theme: w.t }) : toast('PLAY MORE FIRST'); } },
      { label: 'BACK TO MAP', onClick: back },
    ])),
  );
});

register('puzzle', (el, params) => {
  let player = null;
  const exclude = new Set();
  async function next() {
    if (player) player.stop();
    el.innerHTML = '';
    let pz = null;
    let title = 'PUZZLE';
    if (params.mode === 'review') {
      const d = S.due('pz:');
      if (!d.length) { el.append(win('ALL CAUGHT UP', h('p', { class: 'para' }, 'No more puzzle reviews due. Nice work!')), h('section', { class: 'window' }, menu([{ label: 'BACK', onClick: back }]))); return; }
      pz = await D.puzzleById(d[0].key.slice(3));
      title = `REVIEW · ${d.length} LEFT`;
      if (!pz) { S.state().cards[d[0].key].due = Date.now() + 864e5; S.save(); return next(); }
    } else {
      pz = await pickPuzzle({ theme: params.theme || null, exclude });
      title = params.theme ? (THEME_LABEL[params.theme] || params.theme).toUpperCase() : 'PUZZLE';
    }
    exclude.add(pz.id);
    player = playPuzzle(el, pz, {
      mode: params.mode === 'review' ? 'review' : params.theme ? 'theme' : 'rated',
      title, blind: params.blind,
      onNext: next,
      onRetry: () => { player.stop(); el.innerHTML = ''; player = playPuzzle(el, pz, { mode: 'review', title: 'RETRY', blind: params.blind, onNext: next }); },
    });
  }
  next();
  return () => player && player.stop();
});

// ---------- Tactics Village ----------
register('tactics', async (el) => {
  el.append(win('TACTICS VILLAGE', h('p', { class: 'para' }, 'Train one pattern at a time. Colours show how you\'re doing: red = weak, gold = learning, green = strong.')));
  const all = await D.puzzles();
  const counts = {};
  for (const p of all) for (const t of p.themes.split(' ')) counts[t] = (counts[t] || 0) + 1;
  const weak = S.weakThemes(TACTIC_THEMES).slice(0, 3).map((w) => w.t);
  const list = h('div', { class: 'list' });
  const themes = TACTIC_THEMES.filter((t) => counts[t]).sort((a, b) => (weak.includes(b) - weak.includes(a)));
  for (const t of themes) {
    const r = S.themeRate(t), a = (S.state().themes[t] || {}).a || 0;
    const cls = a < 3 ? 'new' : r < 0.5 ? 'weak' : r < 0.75 ? 'learn' : 'good';
    list.append(h('button', { class: 'item', onClick: () => { sfx('select'); go('puzzle', { mode: 'theme', theme: t }); } },
      h('span', { class: `dotc ${cls}` }), THEME_LABEL[t] || t,
      weak.includes(t) ? h('span', { class: 'chip red' }, 'WEAK') : null,
      h('span', { class: 'meta' }, a ? `${Math.round(r * 100)}% of ${a}` : `${counts[t]} puzzles`)));
  }
  el.append(list, h('section', { class: 'window' }, menu([{ label: 'BACK TO MAP', onClick: back }])));
});

// ---------- Rush Arena ----------
register('rush', (el) => {
  const rec = S.state().records;
  el.append(
    win('RUSH ARENA', h('p', { class: 'para' }, 'Solve as many puzzles as you can before time runs out. Puzzles get harder as you go. Three mistakes and you\'re out!')),
    win('RECORDS', h('p', { class: 'para' }, `3 minutes: ${rec.rush3}   ·   5 minutes: ${rec.rush5}`)),
    h('section', { class: 'window' }, menu([
      { label: '3 MINUTE RUSH', onClick: () => go('rushplay', { min: 3 }) },
      { label: '5 MINUTE RUSH', onClick: () => go('rushplay', { min: 5 }) },
      { label: 'BACK TO MAP', onClick: back },
    ])));
});

register('rushplay', (el, { min }) => {
  let score = 0, strikes = 0, rating = 600, ended = false, player = null;
  const end = Date.now() + min * 60000;
  const exclude = new Set();
  const bar = h('section', { class: 'window tight status' });
  const holder = h('div', { class: 'col', style: 'gap:12px' });
  el.append(bar, holder);
  const tick = setInterval(draw, 250);
  function draw() {
    const left = Math.max(0, end - Date.now());
    const s = Math.ceil(left / 1000);
    bar.innerHTML = '';
    bar.append(h('span', { class: 'timer ' + (s <= 10 ? 'red blink' : '') }, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`),
      h('span', { class: 'px' }, `SCORE ${score}`),
      h('span', { class: 'red' }, '✕'.repeat(strikes) + '·'.repeat(3 - strikes)));
    if (left <= 0) gameOver();
  }
  async function next() {
    if (ended) return;
    const pz = await pickPuzzle({ rating, exclude, weakBias: false });
    exclude.add(pz.id);
    holder.innerHTML = '';
    let missed = false;
    player = playPuzzle(holder, pz, {
      mode: 'rush', title: `#${score + strikes + 1}`, allowHints: false, quiet: true,
      onDone: (r) => {
        if (ended) return;
        if (r.clean) { score++; rating += 60; sfx('good'); } else if (!missed) { strikes++; }
        draw();
        if (strikes >= 3) gameOver(); else setTimeout(next, 350);
      },
    });
    // In rush a wrong move counts as a strike and skips the puzzle
    const b = player.board;
    const orig = b.opts.onMove;
    b.opts.onMove = async (uci) => {
      const ok = await orig(uci);
      if (ok === false && !missed) {
        missed = true; strikes++; draw();
        if (strikes >= 3) gameOver(); else setTimeout(next, 600);
      }
      return ok;
    };
  }
  function gameOver() {
    if (ended) return;
    ended = true; clearInterval(tick); if (player) player.stop();
    const rec = S.state().records;
    const key = min === 3 ? 'rush3' : 'rush5';
    const best = score > rec[key];
    if (best) { rec[key] = score; }
    S.addXP(score * 4); S.touchStreak(); S.save();
    if (score >= 20 && S.badge('rush20')) toast('BADGE: RUSH 20!');
    sfx(best ? 'level' : 'good');
    el.innerHTML = '';
    el.append(win('TIME!', h('div', { class: 'big' }, `${score}`), h('p', { class: 'para center' }, best ? 'NEW PERSONAL BEST!' : `Best: ${rec[key]}`)),
      h('section', { class: 'window' }, menu([
        { label: 'PLAY AGAIN', onClick: () => go('rushplay', { min }, true) },
        { label: 'BACK', onClick: back },
      ])));
  }
  draw(); next();
  return () => { ended = true; clearInterval(tick); if (player) player.stop(); };
});

export { mainTheme };
