// My Puzzles: add positions from your own books (set up the board, play the solution, save).
import { h, win, menu, cmd, register, go, back, sfx, toast, refresh } from './ui.js';
import { Board } from './board.js';
import { Chess } from './vendor/chess.js';
import * as S from './store.js';
import { TACTIC_THEMES, playPuzzle } from './puzzles.js';
import { THEME_LABEL } from './explain.js';

register('mypuzzles', (el) => {
  const list = S.state().custom || [];
  let armed = null;
  el.append(win('MY PUZZLES', h('p', { class: 'para' }, 'Puzzles you added from your own books. They get hints, reviews and the weakness tracker like all the others.')),
    h('section', { class: 'window' }, menu([
      { label: 'ADD A PUZZLE', onClick: () => go('addpuzzle') },
      { label: 'BACK', onClick: back },
    ])));
  const box = h('div', { class: 'list' });
  if (!list.length) box.append(h('p', { class: 'para dim center' }, 'No puzzles yet.'));
  list.slice().reverse().forEach((p) => {
    const del = h('button', { class: 'btn alt', style: 'min-height:36px;padding:0 8px;font-size:9px', onClick: (e) => {
      e.stopPropagation();
      if (armed !== p.id) { armed = p.id; toast('TAP DELETE AGAIN'); setTimeout(() => (armed = null), 2500); return; }
      S.state().custom = S.state().custom.filter((x) => x.id !== p.id); delete S.state().cards['pz:' + p.id]; S.save(); refresh();
    } }, 'DELETE');
    box.append(h('button', { class: 'item', onClick: () => go('playmine', { id: p.id }) },
      h('span', { class: 'grow' }, p.name || 'Untitled', h('br'), h('span', { class: 'soft', style: 'font-size:18px' }, [p.book, p.page ? 'p.' + p.page : null].filter(Boolean).join(', ') || '—')), del));
  });
  el.append(box);
});

register('playmine', (el, { id }) => {
  const p = (S.state().custom || []).find((x) => x.id === id);
  if (!p) { back(); return; }
  const pz = { ...p, source: 'mine' };
  let pl = playPuzzle(el, pz, { mode: 'review', title: 'MY PUZZLE', onRetry: () => { pl.stop(); el.innerHTML = ''; pl = playPuzzle(el, pz, { mode: 'review', title: 'MY PUZZLE' }); } });
  return () => pl.stop();
});

register('addpuzzle', (el) => {
  const PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP', 'x'];
  let tool = 'wP', turn = 'w', step = 1, start = null, line = [];
  const head = h('section', { class: 'window msg' }, h('div', { class: 'title-sm' }), h('p'));
  const boardEl = h('div');
  const pal = h('div', { class: 'window tight', style: 'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px' });
  const cmds = h('nav', { class: 'window cmds' });
  const form = h('section', { class: 'window col', style: 'display:none' });
  el.append(head, boardEl, pal, cmds, form);
  const board = new Board(boardEl, { coords: true, onSquare: (sq) => { if (step !== 1) return false; place(sq); return true; }, canMove: () => step === 2, onMove: async (u) => { board.play(u); sfx('move'); line.push(u); draw(); return true; } });
  board.chess.clear(); board.render();
  const say = (t, p) => { head.firstChild.textContent = t; head.lastChild.textContent = p; };

  function place(sq) {
    if (tool === 'x') board.chess.remove(sq);
    else {
      board.chess.remove(sq);
      if (!board.chess.put({ type: tool[1].toLowerCase(), color: tool[0] }, sq)) toast('ONLY ONE KING EACH');
    }
    sfx('select'); board.render();
  }
  function setupFen() {
    const parts = board.chess.fen().split(' ');
    parts[1] = turn; parts[2] = '-'; parts[3] = '-'; parts[4] = '0'; parts[5] = '1';
    return parts.join(' ');
  }
  function draw() {
    pal.innerHTML = ''; cmds.innerHTML = '';
    if (step === 1) {
      pal.style.display = 'grid';
      say('1 · SET UP THE POSITION', 'Pick a piece below, then tap squares to place it (✕ erases). Or paste a FEN code.');
      for (const p of PIECES) {
        pal.append(h('button', { style: `aspect-ratio:1;border:3px solid ${tool === p ? 'var(--gold)' : '#000'};background:var(--light);cursor:pointer;padding:2px`, onClick: () => { tool = p; draw(); } },
          p === 'x' ? h('span', { class: 'px', style: 'color:#B02818;font-size:14px' }, '✕') : h('img', { src: `img/pieces/${p}.svg`, alt: p, style: 'width:100%;image-rendering:pixelated' })));
      }
      pal.append(h('button', { class: 'cmd', style: 'grid-column:span 7', onClick: () => { turn = turn === 'w' ? 'b' : 'w'; draw(); } }, `TO MOVE: ${turn === 'w' ? 'WHITE' : 'BLACK'}`));
      cmds.append(cmd('CLEAR', () => { board.chess.clear(); board.render(); }), cmd('START POS', () => { board.chess.reset(); board.render(); }),
        cmd('PASTE FEN', pasteFen), cmd('FLIP', () => board.setOrientation(board.orientation === 'w' ? 'b' : 'w')), cmd('NEXT ▶', toSolution), cmd('CANCEL', back));
    } else if (step === 2) {
      pal.style.display = 'none';
      say('2 · PLAY THE SOLUTION', `Play the winning move, then the opponent's reply, and so on — as the book gives it. End on the solver's move. Moves: ${sanLine() || '…'}`);
      cmds.append(cmd('UNDO', () => { if (line.length) { board.undo(); line.pop(); draw(); } }), cmd('◀ EDIT', () => { step = 1; board.load(start); line = []; draw(); }),
        cmd('NEXT ▶', () => { if (!line.length || line.length % 2 === 0) { toast('END ON THE SOLVER\'S MOVE'); return; } step = 3; draw(); }), cmd('CANCEL', back));
    } else {
      cmds.style.display = 'none'; form.style.display = 'flex';
      say('3 · DETAILS', `Solution: ${sanLine()}`);
      const name = h('input', { type: 'text', placeholder: 'Name (e.g. Knight fork #12)', style: inputCss });
      const book = h('input', { type: 'text', placeholder: 'Book', style: inputCss });
      const page = h('input', { type: 'text', placeholder: 'Page', inputmode: 'numeric', style: inputCss });
      const theme = h('select', { style: inputCss }, h('option', { value: '' }, 'Theme (optional)'), TACTIC_THEMES.map((t) => h('option', { value: t }, THEME_LABEL[t] || t)));
      let diff = 1400;
      const seg = h('div', { class: 'seg' });
      const drawSeg = () => { seg.innerHTML = ''; [[1000, 'Easy'], [1400, 'Medium'], [1900, 'Hard']].forEach(([v, l]) => seg.append(h('button', { class: diff === v ? 'on' : '', onClick: () => { diff = v; drawSeg(); } }, l))); };
      drawSeg();
      form.append(h('label', {}, 'Name', name), h('label', {}, 'Book', book), h('label', {}, 'Page', page), h('label', {}, 'Theme', theme), h('div', { class: 'toggle' }, h('span', {}, 'Difficulty'), seg),
        menu([
          { label: 'SAVE PUZZLE', onClick: () => {
            const p = { id: 'c' + Date.now().toString(36), fen: start, moves: line.join(' '), rating: diff, themes: theme.value || '', solverFirst: true, name: name.value.trim() || 'My puzzle', book: book.value.trim(), page: page.value.trim() };
            S.state().custom = S.state().custom || []; S.state().custom.push(p); S.save();
            sfx('good'); toast('PUZZLE SAVED'); go('mypuzzles', {}, true);
          } },
          { label: '◀ BACK TO SOLUTION', onClick: () => { step = 2; form.innerHTML = ''; form.style.display = 'none'; cmds.style.display = ''; draw(); } },
        ]));
    }
  }
  function sanLine() {
    const c = new Chess(start);
    return line.map((u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san).join(' ');
  }
  function pasteFen() {
    cmds.innerHTML = '';
    const inp = h('input', { type: 'text', placeholder: 'Paste FEN here', style: inputCss + ';grid-column:span 2' });
    cmds.append(inp, cmd('LOAD', () => {
      try { const c = new Chess(inp.value.trim()); board.load(c.fen()); turn = c.turn(); draw(); } catch (e) { toast('NOT A VALID FEN'); }
    }), cmd('CANCEL', draw));
    inp.focus();
  }
  function toSolution() {
    const fen = setupFen();
    try {
      const c = new Chess(fen);
      if (c.isGameOver()) { toast('POSITION IS ALREADY OVER'); return; }
      start = c.fen();
    } catch (e) { toast('NEEDS ONE KING EACH, LEGAL POSITION'); return; }
    board.load(start); board.setOrientation(turn); line = []; step = 2; draw();
  }
  draw();
});

const inputCss = 'width:100%;min-height:44px;margin-top:2px;padding:0 10px;background:#08081A;color:var(--white);border:3px solid var(--white);font-family:VT;font-size:22px';
