// Endgame Castle: key endings against Stockfish — win them, or hold the draw.
import { h, win, menu, cmd, register, go, back, sfx, toast } from './ui.js';
import { Board } from './board.js';
import * as S from './store.js';
import * as D from './data.js';
import { analyse, warmUp } from './engine.js';

const GOAL = { mate: 'Checkmate', promote: 'Promote & win', hold: 'Hold the draw', 'promote-stop': 'Stop the pawn' };

function status(id) {
  const c = S.card('eg:' + id);
  if (!c) return 'new';
  if (c.lapses && c.i < 3) return 'weak';
  return c.i >= 7 ? 'good' : 'learn';
}

register('endgames', async (el) => {
  warmUp();
  const ex = await D.extra();
  el.append(win('ENDGAME CASTLE', h('p', { class: 'para' }, 'Key endgames every player should know. Stockfish defends (or attacks) at full strength, so you have to really know the technique.')));
  const list = h('div', { class: 'list' });
  for (const g of ex.endgames) {
    list.append(h('button', { class: 'item', onClick: () => { sfx('select'); go('endgame', { id: g.id }); } },
      h('span', { class: `dotc ${status(g.id)}` }), h('span', {}, g.name, g.credit ? h('br') : null, g.credit ? h('span', { class: 'soft', style: 'font-size:18px' }, g.credit) : null), h('span', { class: 'meta' }, GOAL[g.goal])));
  }
  el.append(list, h('section', { class: 'window' }, menu([{ label: 'BACK TO MAP', onClick: back }])));
});

register('endgame', async (el, { id, quest, onDone }) => {
  const g = (await D.extra()).endgames.find((x) => x.id === id);
  playEndgame(el, g, { quest, onDone });
});

export function playEndgame(el, g, { quest, onDone } = {}) {
  const me = g.side;
  let moves = 0, done = false, slipped = false, tipShown = false, alive = true;
  const st = h('section', { class: 'window tight status' }, h('span', { class: 'px' }, g.name.toUpperCase()), h('span', {}));
  const msgT = h('div', { class: 'title-sm' }), msgP = h('p');
  const msg = h('section', { class: 'window msg' }, msgT, msgP);
  const boardEl = h('div');
  const cmds = h('nav', { class: 'window cmds' });
  el.append(st, msg, boardEl, cmds);
  const board = new Board(boardEl, { orientation: me, coords: S.state().settings.coords, canMove: (c) => !done && c === me, onMove: (u) => mine(u) });
  board.load(g.fen);
  const say = (t, p, cls) => { msgT.textContent = t; msgP.textContent = p; msg.classList.remove('win', 'lose'); if (cls) msg.classList.add(cls); };
  const drawSt = () => { st.lastChild.textContent = `${GOAL[g.goal]} · ${Math.max(0, g.limit - moves)} moves`; };
  function drawCmds() {
    cmds.innerHTML = '';
    if (!done) cmds.append(cmd('TIP', () => { tipShown = true; say('TIP', g.tip); }), cmd('RESTART', restart), cmd(quest ? 'SKIP' : 'BACK', quest ? () => end(false, 'Skipped.') : back));
    else cmds.append(quest ? cmd('CONTINUE', () => onDone && onDone()) : cmd('TRY AGAIN', restart), quest ? null : cmd('BACK', back));
  }
  function restart() { moves = 0; done = false; slipped = false; board.load(g.fen); board.lock(false); intro(); drawCmds(); drawSt(); }
  function intro() { say(GOAL[g.goal].toUpperCase() + (g.credit ? ' · ' + g.credit.toUpperCase() : ''), g.learn + (g.goal === 'hold' ? ` Survive ${g.limit} moves.` : ` You have ${g.limit} moves.`)); }

  function userEval(r) {
    if (!r.score) return 0;
    const v = r.score.mate != null ? (r.score.mate > 0 ? 10000 : -10000) : r.score.cp;
    return board.chess.turn() === me ? v : -v;
  }
  function pawnsOf(color) {
    let n = 0; for (const row of board.chess.board()) for (const p of row) if (p && p.type === 'p' && p.color === color) n++;
    return n;
  }
  function countQueens(color) {
    let n = 0; for (const row of board.chess.board()) for (const p of row) if (p && p.type === 'q' && p.color === color) n++;
    return n;
  }

  async function mine(uci) {
    const mv = board.play(uci); sfx(mv && mv.captured ? 'capture' : 'move');
    moves++; drawSt();
    if (await check(mv)) return true;
    board.lock(true);
    say('STOCKFISH IS THINKING…', '');
    const r = await analyse(board.fen(), { movetime: 600 });
    if (!alive) return true;
    const ev = userEval(r);
    if (r.move) { const m = board.play(r.move); sfx(m && m.captured ? 'capture' : 'move'); }
    if (await check(null, ev)) return true;
    board.lock(false);
    if (g.goal === 'hold') say('HOLDING…', ev < -150 ? 'Careful — Stockfish thinks you\'re in trouble.' : 'So far so good. Keep the defence going.');
    else if (ev < 150 && g.goal !== 'hold') { slipped = true; say('THE WIN SLIPPED…', 'Stockfish thinks this is no longer winning. Tap RESTART and try again.', 'lose'); }
    else say('GOOD', 'Keep going.');
    return true;
  }

  async function check(mv, ev) {
    const c = board.chess;
    if (c.isCheckmate()) return end(c.turn() !== me, c.turn() !== me ? 'Checkmate!' : 'You were checkmated.');
    if (c.isDraw() || c.isStalemate()) return end(g.goal === 'hold', g.goal === 'hold' ? 'Draw reached — defence held!' : (c.isStalemate() ? 'Stalemate! The king had no moves but wasn\'t in check.' : 'It\'s a draw.'));
    if (g.goal === 'promote' && mv && mv.promotion) {
      const r = await analyse(c.fen(), { movetime: 500 });
      return end(userEval(r) >= 500, 'Promoted! The win is in the bag.');
    }
    if (g.goal === 'promote-stop') {
      const opp = me === 'w' ? 'b' : 'w';
      if (pawnsOf(opp) === 0 && countQueens(opp) === 0) return end(true, 'Pawn stopped and won!');
      if (countQueens(opp) > 0) return end(false, 'The pawn promoted.');
    }
    if (g.goal === 'hold' && ev != null && ev < -600) return end(false, 'The position is now lost.');
    if (moves >= g.limit && c.turn() === me) {
      if (g.goal === 'hold') return end(true, `You survived ${g.limit} moves!`);
      return end(false, 'Out of moves. Try a faster method.');
    }
    return false;
  }

  function end(ok, text) {
    done = true; board.lock(true);
    const grade = ok ? (slipped || tipShown ? 1 : 2) : 0;
    S.review('eg:' + g.id, grade);
    if (ok) { S.state().records.endgames++; S.addXP(grade === 2 ? 20 : 10); if (g.id === 'lucena' && S.badge('lucena')) toast('BADGE: LUCENA MASTER!'); }
    S.save();
    sfx(ok ? 'level' : 'bad');
    say(ok ? 'VICTORY!' : 'NOT THIS TIME', text + (ok ? '' : ' It will come back for review.'), ok ? 'win' : 'lose');
    drawCmds();
    return true;
  }

  drawSt(); intro(); drawCmds();
  if (board.chess.turn() !== me) {
    board.lock(true);
    analyse(board.fen(), { movetime: 600 }).then((r) => { if (r.move) board.play(r.move); board.lock(false); });
  }
  return () => { alive = false; };
}
