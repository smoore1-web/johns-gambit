// John's Gambit — title screen, world map, Base Camp (daily quest), Hall of Records, options.
import { h, win, menu, cmd, register, go, back, home, mount, sfx, toast, refresh } from './ui.js';
import * as S from './store.js';
import * as D from './data.js';
import { playPuzzle, pickPuzzle, TACTIC_THEMES } from './puzzles.js';
import { runLine } from './openings.js';
import { playEndgame } from './endgames.js';
import { THEME_LABEL } from './explain.js';
import { warmUp } from './engine.js';
import './mypuzzles.js';

// ---------- title ----------
register('title', (el) => {
  el.classList.add('title');
  const stars = h('div', { class: 'stars', 'aria-hidden': 'true' });
  [[8, 5], [82, 8], [54, 3], [14, 24], [90, 22], [28, 14], [74, 17], [5, 13], [62, 27], [40, 9]].forEach(([x, y], i) =>
    stars.append(h('i', { style: `left:${x}%;top:${y}%;${i % 3 === 0 ? 'background:var(--gold)' : ''}${i % 2 ? ';width:2px;height:2px' : ''}` })));
  el.append(stars,
    h('img', { class: 'king', src: 'img/pieces/wK.svg', alt: '' }),
    h('h1', { html: 'JOHN\'S<br>GAMBIT' }),
    h('p', { class: 'tag' }, '~ A Chess Quest ~'),
    h('p', { class: 'press blink' }, 'PRESS START'),
    miniMap(),
    h('section', { class: 'window', style: 'width:240px' }, menu([
      { label: 'START', onClick: () => { warmUp(); home(); } },
      { label: 'CONTINUE', onClick: () => { warmUp(); home(); } },
      { label: 'OPTIONS', onClick: () => go('options') },
    ])));
});

function miniMap() {
  const m = h('div', { class: 'map mini', 'aria-hidden': 'true' }, h('div', { class: 'realm' }, 'THE REALM'));
  const spots = [[18, 30, '▲▲▲', '#2E6B2E', 'PUZZLE FOREST'], [46, 58, '♝', '#4A2E14', 'TACTICS VILLAGE'], [78, 28, '▲▲', '#6E6458', 'OPENING PEAKS'], [76, 74, '♜', '#4A2E14', 'ENDGAME CASTLE'], [16, 80, '✕', '#B02818', 'YOU ARE HERE']];
  for (const [x, y, ic, col, lb] of spots) {
    m.append(h('div', { class: 'place', style: `left:${x}%;top:${y}%;cursor:default` }, h('span', { class: 'ic', style: `color:${col};font-size:24px` }, ic), h('span', { class: 'lb', style: lb === 'YOU ARE HERE' ? 'color:#B02818' : '' }, lb)));
  }
  return m;
}

// ---------- world map ----------
const PLACES = [
  { id: 'camp', name: 'BASE CAMP', ic: '⛺', col: '#8B1E1E', x: 18, y: 88, go: 'camp', desc: 'Daily Quest: a mixed session of reviews, new puzzles, an opening line and an endgame. Optional — train wherever you like.' },
  { id: 'forest', name: 'PUZZLE FOREST', ic: '▲▲▲', col: '#2E6B2E', x: 20, y: 56, go: 'forest', desc: 'Rated puzzles with hints, blindfold mode and a "why" after each one. Missed puzzles come back for review.' },
  { id: 'village', name: 'TACTICS VILLAGE', ic: '♝', col: '#4A2E14', x: 48, y: 68, go: 'tactics', desc: 'Train one pattern at a time: forks, pins, skewers, back-rank mates and more. Your weak themes are marked.' },
  { id: 'castle', name: 'ENDGAME CASTLE', ic: '♜', col: '#4A2E14', x: 78, y: 50, go: 'endgames', desc: 'Key endgames against Stockfish: win them, or hold the draw.' },
  { id: 'peaks', name: 'OPENING PEAKS', ic: '▲▲', col: '#6E6458', x: 74, y: 18, go: 'openings', desc: 'Your opening course: stories, ideas, traps, counters, drills with random replies, the tree view and quizzes.' },
  { id: 'arena', name: 'RUSH ARENA', ic: '⏱', col: '#8B1E1E', x: 24, y: 20, go: 'rush', desc: 'Puzzle Rush: solve as many as you can in 3 or 5 minutes.' },
  { id: 'hall', name: 'HALL OF RECORDS', ic: '♛', col: '#7A5A14', x: 52, y: 38, go: 'hall', desc: 'Your rating, streak, weak themes, records and badges.' },
];
let mapSel = 'forest';

register('map', (el) => {
  const st = S.state();
  const lv = S.level();
  const dueAll = S.dueCount('');
  const status = h('section', { class: 'window tight status' },
    h('span', { class: 'px' }, `JOHN · LV ${lv}`), h('span', {}, `★ ${st.rating}`), h('span', {}, `STREAK ${S.currentStreak()}`));
  const xp = h('div', { class: 'row', style: 'font-size:19px' }, h('span', {}, 'XP'), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(S.levelProgress() * 100)}%` })));
  const map = h('div', { class: 'map' }, h('div', { class: 'realm' }, 'THE REALM'), h('div', { class: 'compass' }, h('span', { html: 'N<br>W ✦ E<br>S' })));
  // dashed paths between places
  const seg = (x1, y1, x2, y2) => {
    const horiz = y1 === y2;
    map.append(h('div', { class: 'path', style: horiz ? `left:${Math.min(x1, x2)}%;top:${y1}%;width:${Math.abs(x2 - x1)}%;border-top-width:3px` : `left:${x1}%;top:${Math.min(y1, y2)}%;height:${Math.abs(y2 - y1)}%;border-left-width:3px` }));
  };
  seg(18, 62, 18, 82); seg(18, 77, 78, 77); seg(78, 56, 78, 77); seg(78, 25, 78, 44); seg(33, 17, 63, 17); seg(52, 44, 52, 63);
  const pawn = h('div', { class: 'pawn' }, h('img', { src: 'img/pieces/wP.svg', alt: '' }));
  const msgT = h('div', { class: 'title-sm' }), msgP = h('p', { class: 'para' });
  function bang(p) {
    if (p.id === 'camp') return dueAll > 0;
    if (p.id === 'forest') return S.dueCount('pz:') > 0;
    if (p.id === 'peaks') return S.dueCount('op:') + S.dueCount('tr:') > 0;
    if (p.id === 'castle') return S.dueCount('eg:') > 0;
    return false;
  }
  const btns = {};
  for (const p of PLACES) {
    const b = h('button', { class: 'place', style: `left:${p.x}%;top:${p.y}%`, 'aria-label': p.name, onClick: () => select(p.id, true) },
      h('span', { class: 'ic', style: `color:${p.col}` }, p.ic), h('span', { class: 'lb' }, p.name), bang(p) ? h('span', { class: 'bang' }, '!') : null);
    btns[p.id] = b; map.append(b);
  }
  map.append(pawn);
  function select(id, tapped) {
    const p = PLACES.find((x) => x.id === id);
    if (tapped && mapSel === id) { enter(); return; }
    mapSel = id;
    Object.values(btns).forEach((b) => b.classList.remove('on'));
    btns[id].classList.add('on');
    pawn.style.left = p.x + '%'; pawn.style.top = (p.y - 3) + '%';
    msgT.textContent = p.name; msgP.textContent = p.desc;
    if (tapped) sfx('select');
  }
  function enter() { const p = PLACES.find((x) => x.id === mapSel); sfx('select'); go(p.go); }
  el.append(status, xp, map,
    h('section', { class: 'window msg' }, msgT, msgP,
      h('div', { class: 'row', style: 'margin-top:4px' }, cmd('ENTER', enter), cmd('OPTIONS', () => go('options')))));
  select(mapSel, false);
});

// ---------- Base Camp: daily quest ----------
register('camp', (el) => {
  const st = S.state();
  const due = S.dueCount('');
  el.append(
    win('BASE CAMP', h('p', { class: 'para' }, `Today's quest: about ${st.settings.sessionMin} minutes. Reviews first, then new puzzles (weighted toward your weak themes), one opening line and one endgame.`)),
    win('READY', h('p', { class: 'para' }, `Reviews due: ${due}.  Streak: ${S.currentStreak()} day${S.currentStreak() === 1 ? '' : 's'}.`)),
    h('section', { class: 'window' }, menu([
      { label: 'BEGIN DAILY QUEST', onClick: () => go('quest') },
      { label: 'REVIEW EVERYTHING DUE', sub: `${due}`, onClick: () => due ? go('quest', { reviewOnly: true }) : toast('NOTHING DUE') },
      { label: 'BACK TO MAP', onClick: back },
    ])));
});

async function buildQuest(reviewOnly) {
  const st = S.state();
  const len = st.settings.sessionMin;
  const nRev = reviewOnly ? 999 : len <= 5 ? 2 : len <= 10 ? 4 : 8;
  const nNew = reviewOnly ? 0 : len <= 5 ? 2 : len <= 10 ? 3 : 6;
  const tasks = S.due('').slice(0, nRev).map((d) => ({ type: 'review', key: d.key }));
  for (let i = 0; i < nNew; i++) tasks.push({ type: 'puzzle' });
  if (!reviewOnly) {
    const course = await D.course();
    const rep = [...st.repertoire.white, ...st.repertoire.black];
    const pool = rep.length ? course.filter((o) => rep.includes(o.id)) : course.filter((o) => o.id === 'italian');
    const o = pool[Math.floor(Math.random() * pool.length)];
    const li = o.lines.findIndex((_, i) => !S.card(`op:${o.id}:${i}`));
    tasks.push({ type: 'line', id: o.id, li: li >= 0 ? li : Math.floor(Math.random() * o.lines.length) });
    if (len >= 10) {
      const ex = await D.extra();
      const eg = ex.endgames.find((g) => !S.card('eg:' + g.id)) || ex.endgames[Math.floor(Math.random() * ex.endgames.length)];
      tasks.push({ type: 'endgame', id: eg.id });
    }
  }
  return tasks;
}

register('quest', (el, params) => {
  let tasks = null, i = 0, ok = 0, xp0 = S.state().xp, stopper = null, alive = true;
  const exclude = new Set();
  const bar = h('section', { class: 'window tight status' });
  const holder = h('div', { class: 'col', style: 'gap:12px' });
  el.append(bar, holder);
  const drawBar = (label) => { bar.innerHTML = ''; bar.append(h('span', { class: 'px' }, `QUEST ${Math.min(i + 1, tasks.length)}/${tasks.length}`), h('span', {}, label)); };
  const next = () => { if (stopper) { try { stopper(); } catch (e) { /* */ } stopper = null; } i++; run(); };
  async function run() {
    if (!alive) return;
    holder.innerHTML = '';
    if (i >= tasks.length) return summary();
    const t = tasks[i];
    if (t.type === 'review' && t.key.startsWith('pz:')) {
      const pz = await D.puzzleById(t.key.slice(3));
      if (!pz) return next();
      drawBar('puzzle review');
      const p = playPuzzle(holder, pz, { mode: 'review', title: 'REVIEW', onNext: next, onDone: (r) => { if (r.grade) ok++; } });
      stopper = p.stop;
    } else if (t.type === 'puzzle') {
      const pz = await pickPuzzle({ exclude });
      exclude.add(pz.id);
      drawBar('new puzzle');
      const p = playPuzzle(holder, pz, { mode: 'quest', title: 'PUZZLE', onNext: next, onDone: (r) => { if (r.grade) ok++; if (r.skipped) next(); } });
      stopper = p.stop;
    } else if (t.type === 'line' || (t.type === 'review' && t.key.startsWith('op:'))) {
      const course = await D.course();
      const [oid, li] = t.type === 'line' ? [t.id, t.li] : t.key.split(':').slice(1);
      const o = course.find((x) => x.id === oid);
      if (!o) return next();
      drawBar('opening line');
      const ctx = {};
      runLine(holder, o, +li, ctx, () => { ok++; next(); });
      stopper = () => ctx.stop && ctx.stop();
    } else if (t.type === 'review' && t.key.startsWith('tr:')) {
      const tr = (await D.extra()).traps.find((x) => 'tr:' + x.id === t.key);
      if (!tr) return next();
      drawBar('trap review');
      const ctx = {};
      runLine(holder, { id: 'trap', name: tr.name, side: tr.side, cardKey: () => t.key, lines: [{ name: tr.name, moves: tr.moves }] }, 0, ctx, () => { ok++; next(); });
      stopper = () => ctx.stop && ctx.stop();
    } else if (t.type === 'endgame' || (t.type === 'review' && t.key.startsWith('eg:'))) {
      const gid = t.type === 'endgame' ? t.id : t.key.slice(3);
      const g = (await D.extra()).endgames.find((x) => x.id === gid);
      if (!g) return next();
      drawBar('endgame');
      stopper = playEndgame(holder, g, { quest: true, onDone: () => { ok++; next(); } });
    } else next();
  }
  function summary() {
    S.touchStreak(); S.save();
    const st = S.state();
    if (S.currentStreak() >= 7 && S.badge('streak7')) toast('BADGE: 7-DAY STREAK!');
    sfx('level');
    el.innerHTML = '';
    el.append(win('QUEST COMPLETE!', h('div', { class: 'big' }, `+${st.xp - xp0} XP`),
      h('p', { class: 'para center' }, `Tasks finished: ${tasks.length}.  Streak: ${S.currentStreak()} days.  Due tomorrow: ${S.due('', Date.now() + 864e5).length}.`)),
      h('section', { class: 'window' }, menu([{ label: 'BACK TO MAP', onClick: home }])));
  }
  buildQuest(params.reviewOnly).then((t) => { tasks = t; if (!tasks.length) { tasks = [{ type: 'puzzle' }]; } i = 0; drawBar(''); run(); });
  return () => { alive = false; if (stopper) stopper(); };
});

// ---------- Hall of Records ----------
const BADGES = { first: 'First victory', hundred: '100 puzzles solved', rush20: 'Rush score of 20', lucena: 'Lucena master', streak7: '7-day streak' };
register('hall', (el) => {
  const st = S.state(), r = st.records;
  const weak = S.weakThemes(TACTIC_THEMES);
  const hist = st.history.slice(-14);
  const maxDay = Math.max(1, ...hist.map((d) => d.ok + d.fail));
  el.append(
    win('HALL OF RECORDS',
      h('div', { class: 'row' }, h('span', {}, 'Puzzle rating'), h('span', { class: 'gold' }, String(st.rating))),
      h('div', { class: 'row' }, h('span', {}, 'Level'), h('span', {}, `${S.level()}  (${st.xp} XP)`)),
      h('div', { class: 'row' }, h('span', {}, 'Streak'), h('span', {}, `${S.currentStreak()} days (best ${st.streak.best})`)),
      h('div', { class: 'row' }, h('span', {}, 'Puzzles solved'), h('span', {}, String(r.solved))),
      h('div', { class: 'row' }, h('span', {}, 'Hardest solved'), h('span', {}, r.hardest ? String(r.hardest) : '—')),
      h('div', { class: 'row' }, h('span', {}, 'Best clean run'), h('span', {}, String(r.bestCleanRun))),
      h('div', { class: 'row' }, h('span', {}, 'Rush 3 / 5 min'), h('span', {}, `${r.rush3} / ${r.rush5}`)),
      h('div', { class: 'row' }, h('span', {}, 'Endgames won'), h('span', {}, String(r.endgames))),
      h('div', { class: 'row' }, h('span', {}, 'Opening lines drilled'), h('span', {}, String(r.lines)))),
    win('REVIEWS DUE',
      h('div', { class: 'row' }, h('span', {}, 'Puzzles'), h('span', {}, String(S.dueCount('pz:')))),
      h('div', { class: 'row' }, h('span', {}, 'Opening lines'), h('span', {}, String(S.dueCount('op:')))),
      h('div', { class: 'row' }, h('span', {}, 'Traps'), h('span', {}, String(S.dueCount('tr:')))),
      h('div', { class: 'row' }, h('span', {}, 'Endgames'), h('span', {}, String(S.dueCount('eg:'))))),
    win('WEAKNESS TRACKER', weak.length
      ? h('div', { class: 'col' }, weak.slice(0, 8).map((w) => h('button', { class: 'item', onClick: () => go('puzzle', { mode: 'theme', theme: w.t }) },
        h('span', { class: `dotc ${w.rate < 0.5 ? 'weak' : w.rate < 0.75 ? 'learn' : 'good'}` }), THEME_LABEL[w.t] || w.t, h('span', { class: 'meta' }, `${Math.round(w.rate * 100)}% of ${w.a}`))))
      : h('p', { class: 'para' }, 'Solve a few more puzzles and your weakest themes will show up here.')),
    win('LAST 14 DAYS', hist.length ? h('div', { class: 'bars' }, hist.map((d) => h('i', { style: `height:${Math.round(((d.ok + d.fail) / maxDay) * 100)}%`, title: d.d }))) : h('p', { class: 'para' }, 'No training yet.')),
    win('BADGES', h('div', { class: 'col' }, Object.entries(BADGES).map(([k, v]) => h('div', { class: 'row' }, h('span', { class: st.badges[k] ? 'gold' : 'dim' }, (st.badges[k] ? '★ ' : '☆ ') + v))))),
    h('section', { class: 'window' }, menu([{ label: 'BACK', onClick: back }])));
});

// ---------- options ----------
register('options', (el) => {
  const st = S.state(), set = st.settings;
  const seg = (vals, cur, f) => h('div', { class: 'seg' }, vals.map(([v, l]) => h('button', { class: cur === v ? 'on' : '', onClick: () => { f(v); S.save(); sfx('select'); refresh(); } }, l)));
  let confirmReset = false;
  const resetItem = { label: 'RESET ALL PROGRESS', onClick: () => {
    if (!confirmReset) { confirmReset = true; toast('TAP AGAIN TO CONFIRM'); setTimeout(() => (confirmReset = false), 3000); return; }
    S.resetAll(); toast('PROGRESS RESET'); refresh();
  } };
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onChange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { S.importJSON(await f.text()); toast('BACKUP RESTORED'); refresh(); } catch (err) { toast('NOT A VALID BACKUP'); }
  } });
  el.append(
    win('OPTIONS',
      h('div', { class: 'toggle' }, h('span', {}, 'Explanations'), seg([['auto', 'Auto'], ['beginner', 'Simple'], ['intermediate', 'Medium'], ['advanced', 'Expert']], set.explain, (v) => (set.explain = v))),
      h('div', { class: 'toggle' }, h('span', {}, 'Night mode'), seg([[false, 'Off'], [true, 'On']], !!set.night, (v) => { set.night = v; document.body.classList.toggle('night', v); })),
      h('div', { class: 'toggle' }, h('span', {}, 'Sound'), seg([[true, 'On'], [false, 'Off']], set.sound, (v) => (set.sound = v))),
      h('div', { class: 'toggle' }, h('span', {}, 'Coordinates'), seg([[true, 'On'], [false, 'Off']], set.coords, (v) => (set.coords = v))),
      h('div', { class: 'toggle' }, h('span', {}, 'Daily quest'), seg([[5, '5 min'], [10, '10 min'], [20, '20 min']], set.sessionMin, (v) => (set.sessionMin = v)))),
    win('PUZZLE SOURCES',
      h('div', { class: 'toggle' }, h('span', {}, 'Master games'), seg([[true, 'On'], [false, 'Off']], set.sources.masters, (v) => (set.sources.masters = v))),
      h('div', { class: 'toggle' }, h('span', {}, 'My puzzles'), seg([[true, 'On'], [false, 'Off']], set.sources.mine, (v) => (set.sources.mine = v))),
      h('div', { class: 'toggle' }, h('span', {}, 'Extra pack (Lichess)'), seg([[true, 'On'], [false, 'Off']], set.sources.lichess, (v) => (set.sources.lichess = v))),
      (() => { const p = h('p', { class: 'para dim', style: 'font-size:19px' }, 'Master-game puzzles are the main set. The extra pack adds thousands more for drills and Rush.');
        D.masters().then((m) => { p.textContent = `Master collection: ${m.length} puzzles — it grows with every update. Until it passes 400, the extra pack tops it up automatically.`; });
        return p; })()),
    win('YOUR DATA', h('p', { class: 'para' }, 'Progress is saved on this phone. Make a backup before reinstalling.'),
      menu([
        { label: 'SAVE BACKUP', onClick: () => {
          const json = S.exportJSON();
          if (window.Android && window.Android.saveBackup) { if (!window.Android.saveBackup(json)) toast('COULD NOT SAVE'); return; }
          const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'johns-gambit-backup.json' });
          document.body.append(a); a.click(); a.remove();
        } },
        { label: 'RESTORE BACKUP', onClick: () => fileIn.click() },
        resetItem,
      ]), fileIn),
    win('ABOUT', h('p', { class: 'para' }, "John's Gambit · offline chess trainer. Main puzzles mined from historical master games with Stockfish. Optional extra pack: Lichess puzzle database (CC0). Engine: Stockfish (GPLv3). Original pixel pieces made for John's Gambit.")),
    h('section', { class: 'window' }, menu([{ label: 'BACK', onClick: back }])));
});

// ---------- boot ----------
mount(document.getElementById('app'));
document.body.classList.toggle('night', !!S.state().settings.night);
window.JG = { back };
go('title');
