// Opening Peaks: course, repertoire drills, traps, guess the move, quizzes.
import { h, win, menu, cmd, register, go, back, sfx, toast } from './ui.js';
import { Board } from './board.js';
import { Chess } from './vendor/chess.js';
import * as S from './store.js';
import * as D from './data.js';
import { analyse } from './engine.js';

const GROUPS = [
  ['WHITE OPENINGS', (o) => o.side === 'w' && !o.counter],
  ['BLACK VS 1.e4', (o) => o.side === 'b' && !o.counter && o.vs.includes('e4')],
  ['BLACK VS 1.d4', (o) => o.side === 'b' && !o.counter && !o.vs.includes('e4')],
  ['COUNTERS', (o) => o.counter],
];

function lineStatus(key) {
  const c = S.card(key);
  if (!c) return 'new';
  if (c.lapses && c.i < 3) return 'weak';
  if (c.i >= 7) return 'good';
  return 'learn';
}
function openingStatus(o) {
  const st = o.lines.map((_, i) => lineStatus(`op:${o.id}:${i}`));
  if (st.every((s) => s === 'good')) return 'good';
  if (st.some((s) => s === 'weak')) return 'weak';
  if (st.some((s) => s !== 'new')) return 'learn';
  return 'new';
}
const inRep = (o) => S.state().repertoire[o.side === 'w' ? 'white' : 'black'].includes(o.id);
function toggleRep(o) {
  const r = S.state().repertoire[o.side === 'w' ? 'white' : 'black'];
  const i = r.indexOf(o.id);
  if (i >= 0) r.splice(i, 1); else r.push(o.id);
  S.save();
}
const sans = (s) => s.split(' ');
function numbered(list, start = 0) {
  return list.map((m, i) => ((start + i) % 2 === 0 ? `${(start + i) / 2 + 1}.${m}` : m)).join(' ');
}

// ---------- hub ----------
register('openings', async (el) => {
  const course = await D.course();
  const rep = S.state().repertoire;
  const mastered = S.mastered('op:');
  const total = course.reduce((n, o) => n + o.lines.length, 0);
  el.append(
    win('OPENING PEAKS', h('p', { class: 'para' }, `Lines mastered: ${mastered} / ${total}. Your repertoire: ${rep.white.length} as White, ${rep.black.length} as Black.`)),
    h('section', { class: 'window' }, menu([
      { label: 'OPENING COURSE', sub: `${course.length}`, onClick: () => go('course') },
      { label: 'DRILL REPERTOIRE', sub: `${S.dueCount('op:')} due`, onClick: () => (rep.white.length + rep.black.length) ? go('drill', { rep: true }) : toast('ADD OPENINGS FIRST') },
      { label: 'OPENING TREE', onClick: () => go('tree') },
      { label: 'TRAP TRAINER', onClick: () => go('traps') },
      { label: 'GUESS THE MOVE', onClick: () => go('classics') },
      { label: 'NAME THAT OPENING', onClick: () => go('nameit') },
      { label: 'OPENING FINDER', sub: 'quiz', onClick: () => go('finder') },
      { label: 'PAWN STRUCTURES', onClick: () => go('structures') },
      { label: 'BEGINNER PRINCIPLES', onClick: () => go('principles') },
      { label: 'BACK TO MAP', onClick: back },
    ])));
});

register('course', async (el) => {
  const course = await D.course();
  el.append(win('OPENING COURSE', h('p', { class: 'para' }, '★ = in your repertoire. Dot: grey new, gold learning, red needs work, green mastered.')));
  for (const [label, f] of GROUPS) {
    const list = h('div', { class: 'list' });
    for (const o of course.filter(f)) {
      list.append(h('button', { class: 'item', onClick: () => { sfx('select'); go('lesson', { id: o.id }); } },
        h('span', { class: `dotc ${openingStatus(o)}` }), h('span', {}, o.name.replace('Counter: ', '')),
        h('span', { class: 'meta' }, (inRep(o) ? '★ ' : '') + o.eco)));
    }
    el.append(h('div', { class: 'title-sm', style: 'margin-top:6px' }, label), list);
  }
  el.append(h('section', { class: 'window' }, menu([{ label: 'BACK', onClick: back }])));
});

register('lesson', async (el, { id }) => {
  const course = await D.course();
  const extra = await D.extra();
  const o = course.find((x) => x.id === id);
  const struct = extra.structures.find((s) => s.id === o.structure);
  const repBtn = () => (inRep(o) ? 'REMOVE FROM REPERTOIRE' : 'ADD TO REPERTOIRE');
  const m = menu([
    { label: 'PLAY THROUGH', onClick: () => go('stepper', { id }) },
    { label: 'DRILL THESE LINES', sub: `${o.lines.length}`, onClick: () => go('drill', { id }) },
    { label: repBtn(), onClick: () => { toggleRep(o); toast(inRep(o) ? 'ADDED ★' : 'REMOVED'); go('lesson', { id }, true); } },
    { label: 'BACK', onClick: back },
  ]);
  el.append(
    win(o.name.toUpperCase(), h('p', { class: 'para soft' }, `${o.eco} · for ${o.side === 'w' ? 'White' : 'Black'} · vs ${o.vs}`), h('p', { class: 'para' }, o.personality)),
    win('THE STORY', h('p', { class: 'para' }, o.story), h('p', { class: 'para' }, o.famous), h('p', { class: 'para soft' }, 'Fun fact: ' + o.fact)),
    win('MEMORY TRICK', h('p', { class: 'para gold' }, o.memory)),
    win('WHEN TO PLAY IT', h('p', { class: 'para' }, o.when)),
    win('MAIN IDEAS', h('ul', { class: 'b' }, o.ideas.map((x) => h('li', {}, x)))),
    win('WATCH OUT FOR', h('ul', { class: 'b' }, o.watch.map((x) => h('li', {}, x)))),
    struct ? win('PAWN STRUCTURE: ' + struct.name.toUpperCase(), h('p', { class: 'para' }, struct.text)) : null,
    win('LINES', h('div', { class: 'col' }, o.lines.map((l, i) => h('div', { class: 'row' }, h('span', { class: `dotc ${lineStatus(`op:${o.id}:${i}`)}` }), h('span', { class: 'grow' }, l.name))))),
    h('section', { class: 'window' }, m),
  );
});

// ---------- play through a line ----------
register('stepper', async (el, { id, moves: mvStr, title, flip }) => {
  let lines;
  let side = 'w';
  if (id) {
    const o = (await D.course()).find((x) => x.id === id);
    lines = o.lines; side = o.side; title = o.name;
  } else lines = [{ name: title, moves: mvStr }];
  if (flip) side = flip;
  let li = 0, ply = 0;
  const head = win(title.toUpperCase());
  const list = h('p', { class: 'movelist' });
  const boardEl = h('div');
  const cmds = h('nav', { class: 'window cmds' });
  el.append(head, boardEl, h('section', { class: 'window' }, list), cmds);
  const board = new Board(boardEl, { coords: S.state().settings.coords, canMove: () => false, orientation: side });
  board.lock(true);
  function draw() {
    const mv = sans(lines[li].moves);
    const c = new Chess();
    let last = null;
    for (let i = 0; i < ply; i++) last = c.move(mv[i]);
    board.load(c.fen());
    if (last) { board.last = [last.from, last.to]; board.render(); }
    head.querySelector('.title-sm').textContent = `${title.toUpperCase()} · ${lines[li].name}`;
    list.innerHTML = '';
    mv.forEach((m, i) => list.append(h('span', { class: i < ply ? (i === ply - 1 ? 'gold' : '') : 'dim' }, (i % 2 === 0 ? `${i / 2 + 1}.` : '') + m + ' ')));
    cmds.innerHTML = '';
    cmds.append(cmd('◀ PREV', () => { ply = Math.max(0, ply - 1); draw(); }), cmd('NEXT ▶', () => { if (ply < mv.length) { ply++; sfx('move'); } draw(); }),
      lines.length > 1 ? cmd('NEXT LINE', () => { li = (li + 1) % lines.length; ply = 0; draw(); }) : null,
      cmd('FLIP', () => { board.setOrientation(board.orientation === 'w' ? 'b' : 'w'); draw(); }),
      cmd('BACK', back));
  }
  draw();
});

// ---------- drills with random opponent replies ----------
register('drill', async (el, params) => {
  const course = await D.course();
  let pool;
  if (params.rep) {
    const r = S.state().repertoire;
    pool = course.filter((o) => r.white.includes(o.id) || r.black.includes(o.id));
  } else pool = course.filter((o) => o.id === params.id);
  const ctx = { stop: null };
  function pickLine() {
    // due lines first, then new ones, then any
    const due = S.due('op:').filter((d) => pool.some((o) => d.key.startsWith(`op:${o.id}:`)));
    if (due.length) { const [, oid, i] = due[0].key.split(':'); return { o: pool.find((x) => x.id === oid), li: +i }; }
    const fresh = [];
    for (const o of pool) o.lines.forEach((_, i) => { if (!S.card(`op:${o.id}:${i}`)) fresh.push({ o, li: i }); });
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
    const o = pool[Math.floor(Math.random() * pool.length)];
    return { o, li: Math.floor(Math.random() * o.lines.length) };
  }
  function start() {
    el.innerHTML = '';
    const { o, li } = pickLine();
    runLine(el, o, li, ctx, start);
  }
  start();
  return () => ctx.stop && ctx.stop();
});

function runLine(el, o, startLine, ctx, onNext) {
  const me = o.side;
  const lines = o.lines.map((l) => sans(l.moves));
  let target = startLine;
  let mistakes = 0, done = false;
  const timers = [];
  ctx.stop = () => timers.forEach(clearTimeout);
  const status = h('section', { class: 'window tight status' }, h('span', { class: 'px' }, o.name.replace('Counter: ', '').toUpperCase().slice(0, 22)), h('span', {}, me === 'w' ? 'as White' : 'as Black'));
  const msgT = h('div', { class: 'title-sm' }), msgP = h('p');
  const msg = h('section', { class: 'window msg' }, msgT, msgP);
  const boardEl = h('div');
  const list = h('p', { class: 'movelist' });
  const cmds = h('nav', { class: 'window cmds' });
  el.append(status, msg, boardEl, h('section', { class: 'window tight' }, list), cmds);
  const board = new Board(boardEl, { coords: S.state().settings.coords, orientation: me, canMove: (c) => !done && c === me, onMove: (u, mv) => userMove(mv) });
  const say = (t, p, cls) => { msgT.textContent = t; msgP.textContent = p; msg.classList.remove('win', 'lose'); if (cls) msg.classList.add(cls); };
  const hist = () => board.chess.history();
  const matching = () => { const hs = hist(); return lines.map((l, i) => i).filter((i) => hs.every((m, k) => lines[i][k] === m)); };
  function drawList() { list.textContent = numbered(hist()) || '…'; }
  function drawCmds() {
    cmds.innerHTML = '';
    if (!done) cmds.append(cmd('SHOW MOVE', showMove), cmd('BACK', back));
    else cmds.append(cmd(o.cardKey ? 'AGAIN' : 'NEXT LINE', onNext), cmd('OUT OF BOOK', () => outOfBook(el, board.fen(), me, ctx)), o.cardKey ? null : cmd('LESSON', () => go('lesson', { id: o.id })), cmd('BACK', back));
  }
  function expectedMoves() {
    const n = hist().length;
    return [...new Set(matching().map((i) => lines[i][n]).filter(Boolean))];
  }
  function showMove() {
    const exp = expectedMoves();
    if (!exp.length) return;
    mistakes = Math.max(mistakes, 2);
    const c = new Chess(board.fen()); const m = c.move(exp[0]);
    board.clearArrows(); board.arrow(m.from, m.to);
    say('THE BOOK MOVE', `Play ${exp[0]}.`, 'lose');
  }
  async function userMove(mv) {
    const exp = expectedMoves();
    if (!exp.includes(mv.san)) {
      mistakes++; sfx('bad');
      if (mistakes >= 1) {
        const c = new Chess(board.fen()); const m = c.move(exp[0]);
        board.clearArrows(); board.arrow(m.from, m.to);
      }
      say('NOT THE BOOK MOVE', `${mv.san} isn't in this line. The arrow shows the move to play.`, 'lose');
      return false;
    }
    board.clearArrows();
    board.play(mv.from + mv.to + (mv.promotion || '')); sfx(mv.captured ? 'capture' : 'move');
    drawList();
    after();
    return true;
  }
  function after() {
    const m = matching();
    const n = hist().length;
    const cont = m.filter((i) => lines[i].length > n);
    if (!cont.length) { finish(m[0]); return; }
    if (board.chess.turn() !== me) {
      board.lock(true);
      timers.push(setTimeout(() => {
        // random opponent reply among the lines that still match
        const opts = [...new Set(cont.map((i) => lines[i][n]))];
        const pick = opts[Math.floor(Math.random() * opts.length)];
        const c = new Chess(board.fen()); const mm = c.move(pick);
        board.play(mm.from + mm.to + (mm.promotion || '')); sfx(mm.captured ? 'capture' : 'move');
        drawList(); board.lock(false);
        if (opts.length > 1) say('OPPONENT CHOSE A BRANCH', `They played ${pick}. Your move!`);
        else say('YOUR MOVE', 'Play the book move.');
        after();
      }, 500));
    } else if (!done) { say('YOUR MOVE', hist().length ? 'Play the book move.' : `You play ${me === 'w' ? 'White' : 'Black'}. Make the first move of the line.`); }
  }
  function finish(lineIdx) {
    done = true; board.lock(true);
    const grade = mistakes === 0 ? 2 : mistakes === 1 ? 1 : 0;
    const key = o.cardKey ? o.cardKey(lineIdx) : `op:${o.id}:${lineIdx}`;
    S.review(key, grade); S.addXP(grade ? 8 : 2);
    S.state().records.lines++; S.save();
    sfx(grade ? 'good' : 'bad');
    say(grade === 2 ? 'LINE COMPLETE!' : grade === 1 ? 'COMPLETE (1 slip)' : 'KEEP PRACTISING',
      `${o.lines[lineIdx].name}: ${grade === 2 ? 'perfect!' : 'it will come back sooner for review.'} Try OUT OF BOOK to keep playing this position against Stockfish.`, grade ? 'win' : 'lose');
    drawCmds();
  }
  board.lock(false);
  drawList(); drawCmds();
  say('YOUR MOVE', `${o.lines[target].name}. You play ${me === 'w' ? 'White' : 'Black'}.`);
  after();
}

// Keep playing after the book runs out (10 moves against Stockfish)
function outOfBook(el, fen, me, ctx) {
  el.innerHTML = '';
  const skill = Math.max(0, Math.min(20, Math.round((S.state().rating - 800) / 80)));
  let movesLeft = 10, done = false;
  const status = h('section', { class: 'window tight status' }, h('span', { class: 'px' }, 'OUT OF BOOK'), h('span', {}));
  const msgT = h('div', { class: 'title-sm' }), msgP = h('p');
  const boardEl = h('div');
  const cmds = h('nav', { class: 'window cmds' }, cmd('BACK', back));
  el.append(status, h('section', { class: 'window msg' }, msgT, msgP), boardEl, cmds);
  const board = new Board(boardEl, { orientation: me, coords: S.state().settings.coords, canMove: (c) => !done && c === me, onMove: async (u) => { board.play(u); sfx('move'); await reply(); return true; } });
  board.load(fen);
  const say = (t, p) => { msgT.textContent = t; msgP.textContent = p; };
  function drawStatus() { status.lastChild.textContent = `${movesLeft} moves left`; }
  async function reply() {
    movesLeft--; drawStatus();
    if (board.chess.isGameOver() || movesLeft <= 0) return wrap();
    board.lock(true); say('STOCKFISH IS THINKING…', '');
    const r = await analyse(board.fen(), { movetime: 500, skill });
    if (r.move) { const m = board.play(r.move); sfx(m && m.captured ? 'capture' : 'move'); }
    board.lock(false);
    if (board.chess.isGameOver()) return wrap();
    say('YOUR MOVE', 'No more book — use the ideas from the lesson.');
  }
  async function wrap() {
    done = true; board.lock(true); say('CHECKING THE POSITION…', '');
    const r = await analyse(board.fen(), { movetime: 900 });
    let cp = r.score ? (r.score.mate != null ? (r.score.mate > 0 ? 9999 : -9999) : r.score.cp) : 0;
    if (board.chess.turn() !== me) cp = -cp;
    const verdict = cp >= 150 ? 'You came out ahead!' : cp >= -100 ? 'Balanced — you held your own.' : 'You lost ground. Review the main ideas and try again.';
    say('RESULT', `${verdict} (Stockfish: ${cp > 0 ? '+' : ''}${(cp / 100).toFixed(1)})`);
    S.addXP(cp >= -100 ? 10 : 3); S.save();
  }
  if (board.chess.turn() !== me) { movesLeft++; reply(); } else say('YOUR MOVE', 'You\'re out of the book. Play 10 moves and see how you do!');
  drawStatus();
}

// ---------- tree view ----------
register('tree', async (el) => {
  const course = await D.course();
  const r = S.state().repertoire;
  let shown = course.filter((o) => r.white.includes(o.id) || r.black.includes(o.id));
  const note = shown.length ? 'Your repertoire.' : 'No repertoire yet, so here is the whole course.';
  if (!shown.length) shown = course;
  el.append(win('OPENING TREE', h('p', { class: 'para' }, `${note} Green = mastered, gold = learning, red = needs work, grey = new.`)));
  for (const o of shown) {
    const box = h('div', { class: 'tree' });
    const ls = o.lines.map((l, i) => ({ i, m: sans(l.moves), name: l.name })).sort((a, b) => a.m.join(' ').localeCompare(b.m.join(' ')));
    let prev = [];
    for (const l of ls) {
      let k = 0; while (k < prev.length && prev[k] === l.m[k]) k++;
      const rest = l.m.slice(k);
      box.append(h('button', { class: 'node item', style: `margin-left:${Math.min(k, 8) * 6}px`, onClick: () => go('stepper', { moves: l.m.join(' '), title: `${o.name}: ${l.name}`, flip: o.side }) },
        h('span', { class: `dotc ${lineStatus(`op:${o.id}:${l.i}`)}` }),
        h('span', { class: 'grow' }, (k ? '… ' : '') + numbered(rest, k)),
        h('span', { class: 'meta' }, l.name)));
      prev = l.m;
    }
    el.append(win(o.name.toUpperCase(), box));
  }
  el.append(h('section', { class: 'window' }, menu([{ label: 'BACK', onClick: back }])));
});

// ---------- traps ----------
register('traps', async (el) => {
  const ex = await D.extra();
  el.append(win('TRAP TRAINER', h('p', { class: 'para' }, 'Famous opening traps: some to spring on your opponent, some to avoid. Watch them, then practise playing them yourself.')));
  const list = h('div', { class: 'list' });
  for (const t of ex.traps) {
    list.append(h('button', { class: 'item', onClick: () => go('trap', { id: t.id }) },
      h('span', { class: `dotc ${lineStatus('tr:' + t.id)}` }), t.name,
      h('span', { class: 'meta' }, `${t.side === 'w' ? 'White' : 'Black'} · ${t.kind === 'avoid' ? 'defend' : 'spring'}`)));
  }
  el.append(list, h('section', { class: 'window' }, menu([{ label: 'BACK', onClick: back }])));
});
register('trap', async (el, { id }) => {
  const t = (await D.extra()).traps.find((x) => x.id === id);
  el.append(win(t.name.toUpperCase(), h('p', { class: 'para' }, t.note), h('p', { class: 'movelist' }, numbered(sans(t.moves)))),
    h('section', { class: 'window' }, menu([
      { label: 'WATCH IT', onClick: () => go('stepper', { moves: t.moves, title: t.name, flip: t.side }) },
      { label: 'PRACTISE IT', onClick: () => go('trapdrill', { id }) },
      { label: 'BACK', onClick: back },
    ])));
});
register('trapdrill', async (el, { id }) => {
  const t = (await D.extra()).traps.find((x) => x.id === id);
  const ctx = {};
  const fake = { id: 'trap', name: t.name, side: t.side, cardKey: () => 'tr:' + t.id, lines: [{ name: t.name, moves: t.moves }] };
  runLine(el, fake, 0, ctx, () => go('trapdrill', { id }, true));
  return () => ctx.stop && ctx.stop();
});

// ---------- guess the move (classic games) ----------
register('classics', async (el) => {
  const ex = await D.extra();
  el.append(win('GUESS THE MOVE', h('p', { class: 'para' }, 'Play through famous games as the winner. Guess each move — 3 points first try, 2 second, 1 third.')));
  const list = h('div', { class: 'list' });
  for (const g of ex.classics) list.append(h('button', { class: 'item', onClick: () => go('guess', { id: g.id }) }, h('span', { class: 'px' }, String(g.year)), g.name, h('span', { class: 'meta' }, g.players.split(' vs ')[0])));
  el.append(list, h('section', { class: 'window' }, menu([{ label: 'BACK', onClick: back }])));
});
register('guess', async (el, { id }) => {
  const g = (await D.extra()).classics.find((x) => x.id === id);
  const mv = sans(g.moves);
  let ply = 0, tries = 0, score = 0, max = 0, done = false;
  const timers = [];
  const status = h('section', { class: 'window tight status' }, h('span', { class: 'px' }, g.name.toUpperCase()), h('span', {}));
  const msgT = h('div', { class: 'title-sm' }), msgP = h('p');
  const boardEl = h('div');
  const cmds = h('nav', { class: 'window cmds' });
  el.append(status, h('section', { class: 'window msg' }, msgT, msgP), boardEl, cmds);
  const board = new Board(boardEl, { orientation: g.side, coords: S.state().settings.coords, canMove: (c) => !done && c === g.side, onMove: (u, m) => guess(m) });
  const say = (t, p) => { msgT.textContent = t; msgP.textContent = p; };
  const draw = () => { status.lastChild.textContent = `${score}/${max} pts`; };
  say(g.players + ', ' + g.year, g.story);
  cmds.append(cmd('REVEAL', () => reveal()), cmd('BACK', back));
  function step() {
    if (ply >= mv.length) { done = true; sfx('level'); say('GAME OVER', `You scored ${score} out of ${max}. ${score >= max * 0.7 ? 'Masterful!' : 'Try it again to beat your score.'}`); S.addXP(score); S.save(); return; }
    if (board.chess.turn() !== g.side) {
      board.lock(true);
      timers.push(setTimeout(() => { const c = new Chess(board.fen()); const m = c.move(mv[ply]); board.play(m.from + m.to + (m.promotion || '')); sfx('move'); ply++; board.lock(false); step(); }, 600));
    } else { tries = 0; max += 3; draw(); say('YOUR GUESS', `Move ${Math.floor(ply / 2) + 1}: what did the master play?`); }
  }
  function guess(m) {
    if (m.san === mv[ply]) {
      const pts = 3 - tries; score += pts; draw(); sfx('good');
      board.play(m.from + m.to + (m.promotion || '')); ply++;
      say(`CORRECT! +${pts}`, '');
      step(); return true;
    }
    tries++; sfx('bad');
    if (tries >= 3) { reveal(); return false; }
    say('NOT QUITE', `${m.san} wasn't played. ${3 - tries} tries left.`);
    return false;
  }
  function reveal() {
    if (done || board.chess.turn() !== g.side) return;
    const c = new Chess(board.fen()); const m = c.move(mv[ply]);
    board.play(m.from + m.to + (m.promotion || '')); ply++;
    say('THE MASTER PLAYED', `${m.san}.`); step();
  }
  step();
  return () => timers.forEach(clearTimeout);
});

// ---------- name that opening ----------
register('nameit', async (el) => {
  const fam = (n) => n.split(':')[0];
  const all = await D.eco();
  const famCount = {};
  for (const e of all) famCount[fam(e[1])] = (famCount[fam(e[1])] || 0) + 1;
  // stick to well-known openings (families with plenty of variations)
  const eco = all.filter((e) => e[2].split(' ').length >= 4 && famCount[fam(e[1])] >= 15);
  const families = [...new Set(eco.map((e) => fam(e[1])))];
  let q = 0, score = 0;
  const status = h('section', { class: 'window tight status' }, h('span', { class: 'px' }, 'NAME THAT OPENING'), h('span', {}));
  const boardEl = h('div');
  const moveP = h('p', { class: 'movelist center' });
  const opts = h('nav', { class: 'window menu' });
  el.append(status, boardEl, h('section', { class: 'window tight' }, moveP), opts);
  const board = new Board(boardEl, { canMove: () => false, coords: false });
  board.lock(true);
  function ask() {
    if (q >= 10) { opts.innerHTML = ''; opts.append(h('p', { class: 'big' }, `${score}/10`), ...menu([{ label: 'PLAY AGAIN', onClick: () => go('nameit', {}, true) }, { label: 'BACK', onClick: back }]).childNodes); S.addXP(score * 2); S.save(); return; }
    q++;
    status.lastChild.textContent = `Q${q}/10 · ${score} pts`;
    const e = eco[Math.floor(Math.random() * eco.length)];
    const right = fam(e[1]);
    const choices = new Set([right]);
    while (choices.size < 4) choices.add(families[Math.floor(Math.random() * families.length)]);
    const c = new Chess(); const s = [];
    for (const u of e[2].split(' ')) s.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san);
    board.load(c.fen());
    moveP.textContent = numbered(s);
    opts.innerHTML = '';
    for (const name of [...choices].sort(() => Math.random() - 0.5)) {
      opts.append(h('button', { onClick: (ev) => {
        const ok = name === right;
        sfx(ok ? 'good' : 'bad'); if (ok) score++;
        ev.currentTarget.style.color = ok ? 'var(--green)' : 'var(--red)';
        if (!ok) toast(`IT WAS: ${right.toUpperCase().slice(0, 26)}`, 1800);
        setTimeout(ask, ok ? 600 : 1900);
      } }, h('span', { class: 'cur' }, '▶'), name));
    }
  }
  ask();
});

// ---------- opening finder quiz ----------
register('finder', async (el) => {
  const ex = await D.extra();
  const course = await D.course();
  const tags = {};
  let i = 0;
  const box = h('section', { class: 'window' });
  el.append(win('OPENING FINDER', h('p', { class: 'para' }, 'Four quick questions and I\'ll suggest a starter repertoire.')), box);
  function ask() {
    box.innerHTML = '';
    if (i >= ex.finder.length) return result();
    const q = ex.finder[i];
    box.append(h('div', { class: 'title-sm' }, `QUESTION ${i + 1}`), h('p', { class: 'para' }, q.q),
      menu(q.a.map((a) => ({ label: a.t.toUpperCase(), onClick: () => { a.tags.forEach((t) => (tags[t] = (tags[t] || 0) + 1)); i++; ask(); } }))));
  }
  function result() {
    const sharp = (tags.sharp || 0) > (tags.solid || 0);
    const solid = (tags.solid || 0) > (tags.sharp || 0);
    const system = (tags.system || 0) >= 2;
    const theory = !!tags.theory;
    const white = tags.d4 ? (system ? 'london' : 'qg') : system && !tags.e4 ? 'london' : sharp ? (theory ? 'scotch' : 'vienna') : 'italian';
    const vsE4 = sharp ? (theory ? 'najdorf' : 'dragon') : solid ? 'caro' : system ? 'scandi' : 'french';
    const vsD4 = sharp ? (theory ? 'grunfeld' : 'kid') : solid ? 'qgd' : system ? 'slav' : 'nimzo';
    const pick = [white, vsE4, vsD4].map((id) => course.find((o) => o.id === id));
    box.append(h('div', { class: 'title-sm' }, 'YOUR STARTER REPERTOIRE'),
      ...pick.map((o) => h('button', { class: 'item', style: 'margin:6px 0', onClick: () => go('lesson', { id: o.id }) }, o.name, h('span', { class: 'meta' }, o.side === 'w' ? 'as White' : `vs ${o.vs}`))),
      menu([
        { label: 'ADD ALL TO REPERTOIRE', onClick: () => { pick.forEach((o) => { if (!inRep(o)) toggleRep(o); }); toast('ADDED ★'); } },
        { label: 'BACK', onClick: back },
      ]));
  }
  ask();
});

register('structures', async (el) => {
  const ex = await D.extra();
  el.append(win('PAWN STRUCTURES', h('p', { class: 'para' }, 'The pawn skeleton tells you the plan. These come up again and again across openings.')));
  for (const s of ex.structures) el.append(win(s.name.toUpperCase(), h('p', { class: 'para' }, s.text)));
  el.append(h('section', { class: 'window' }, menu([{ label: 'BACK', onClick: back }])));
});
register('principles', async (el) => {
  const ex = await D.extra();
  el.append(win('BEGINNER PRINCIPLES', h('p', { class: 'para' }, 'The rules of thumb behind every opening.')));
  ex.principles.forEach((p, i) => el.append(win(`${i + 1}. ${p.title.toUpperCase()}`, h('p', { class: 'para' }, p.text))));
  el.append(h('section', { class: 'window' }, menu([{ label: 'BACK', onClick: back }])));
});

export { runLine };
