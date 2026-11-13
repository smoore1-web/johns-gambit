// Tap-to-move (and drag-to-move) pixel chess board.
import { Chess } from './vendor/chess.js';

const FILES = 'abcdefgh';

export class Board {
  /**
   * opts: { orientation: 'w'|'b', onMove(from, to, promo) -> bool|Promise<bool>,
   *         canMove(color) -> bool, coords: bool }
   */
  constructor(el, opts = {}) {
    this.el = el;
    this.opts = opts;
    this.orientation = opts.orientation || 'w';
    this.chess = new Chess();
    this.sel = null;
    this.blind = false;
    this.locked = false;
    this.marks = {};       // square -> css class
    this.last = null;
    this.arrows = [];
    this.build();
  }

  build() {
    this.el.innerHTML = '';
    this.el.classList.add('board-wrap');
    this.grid = document.createElement('div');
    this.grid.className = 'board';
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', '0 0 8 8');
    this.svg.setAttribute('class', 'arrows');
    this.svg.innerHTML = '<defs><marker id="ah" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 z" fill="#F8D030"/></marker></defs>';
    this.el.append(this.grid, this.svg);
    this.squares = {};
    for (let i = 0; i < 64; i++) {
      const d = document.createElement('div');
      this.grid.appendChild(d);
    }
    this.grid.addEventListener('pointerdown', (e) => this.down(e));
    this.grid.addEventListener('pointerup', (e) => this.up(e));
    this.layout();
  }

  layout() {
    const cells = this.grid.children;
    this.squares = {};
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const file = this.orientation === 'w' ? f : 7 - f;
        const rank = this.orientation === 'w' ? 8 - r : r + 1;
        const sq = FILES[file] + rank;
        const d = cells[r * 8 + f];
        d.dataset.sq = sq;
        d.className = 'sq ' + ((file + rank) % 2 === 1 ? 'light' : 'dark');
        d.innerHTML = '';
        if (this.opts.coords !== false) {
          if (f === 0) d.insertAdjacentHTML('beforeend', `<span class="co r">${rank}</span>`);
          if (r === 7) d.insertAdjacentHTML('beforeend', `<span class="co f">${FILES[file]}</span>`);
        }
        this.squares[sq] = d;
      }
    }
    this.render();
  }

  setOrientation(o) { this.orientation = o; this.layout(); }
  load(fen) { this.chess.load(fen); this.sel = null; this.last = null; this.marks = {}; this.arrows = []; this.render(); }
  fen() { return this.chess.fen(); }
  setBlind(b) { this.blind = b; this.render(); }
  lock(b) { this.locked = b; }

  mark(sq, cls) { if (cls) this.marks[sq] = cls; else delete this.marks[sq]; this.render(); }
  clearMarks() { this.marks = {}; this.render(); }
  arrow(from, to) { this.arrows.push([from, to]); this.drawArrows(); }
  clearArrows() { this.arrows = []; this.drawArrows(); }

  // Play a move on the board (used for the opponent / engine). uci like 'e2e4' or 'e7e8q'
  play(uci) {
    const mv = this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
    if (mv) { this.last = [mv.from, mv.to]; this.sel = null; this.render(); }
    return mv;
  }
  undo() { const m = this.chess.undo(); this.last = null; this.render(); return m; }

  render() {
    const board = this.chess.board();
    const checkSq = this.chess.inCheck() ? this.kingSquare(this.chess.turn()) : null;
    const legal = this.sel ? this.chess.moves({ square: this.sel, verbose: true }).map((m) => m.to) : [];
    for (const [sq, d] of Object.entries(this.squares)) {
      const f = FILES.indexOf(sq[0]), r = 8 - parseInt(sq[1], 10);
      const p = board[r][f];
      let img = d.querySelector('img');
      if (p && !this.blind) {
        const src = `img/pieces/${p.color}${p.type.toUpperCase()}.svg`;
        if (!img) { img = document.createElement('img'); img.draggable = false; img.alt = ''; d.appendChild(img); }
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      } else if (img) img.remove();
      d.classList.toggle('sel', sq === this.sel);
      d.classList.toggle('last', !!this.last && this.last.includes(sq));
      d.classList.toggle('check', sq === checkSq && !this.blind);
      d.classList.toggle('dot', legal.includes(sq) && !p);
      d.classList.toggle('cap', legal.includes(sq) && !!p);
      d.classList.remove('hint', 'good', 'bad', 'target');
      if (this.marks[sq]) d.classList.add(this.marks[sq]);
      d.setAttribute('aria-label', sq + (p ? ` ${p.color === 'w' ? 'white' : 'black'} ${p.type}` : ''));
    }
    this.drawArrows();
  }

  kingSquare(color) {
    const b = this.chess.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (p && p.type === 'k' && p.color === color) return FILES[f] + (8 - r);
    }
    return null;
  }

  center(sq) {
    let f = FILES.indexOf(sq[0]), r = 8 - parseInt(sq[1], 10);
    if (this.orientation === 'b') { f = 7 - f; r = 7 - r; }
    return [f + 0.5, r + 0.5];
  }
  drawArrows() {
    [...this.svg.querySelectorAll('line')].forEach((l) => l.remove());
    for (const [a, b] of this.arrows) {
      const [x1, y1] = this.center(a), [x2, y2] = this.center(b);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2 - (dx / len) * 0.35); l.setAttribute('y2', y2 - (dy / len) * 0.35);
      l.setAttribute('stroke', '#F8D030'); l.setAttribute('stroke-width', '0.18');
      l.setAttribute('stroke-linecap', 'square'); l.setAttribute('marker-end', 'url(#ah)');
      l.setAttribute('opacity', '0.9');
      this.svg.appendChild(l);
    }
  }

  sqAt(e) {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const d = t && t.closest('.sq');
    return d ? d.dataset.sq : null;
  }
  down(e) {
    if (this.locked) return;
    const sq = this.sqAt(e);
    if (!sq) return;
    const p = this.chess.get(sq);
    const mine = p && p.color === this.chess.turn() && (!this.opts.canMove || this.opts.canMove(p.color));
    if (this.sel && sq !== this.sel && !mine) { this.tryMove(this.sel, sq); return; }
    if (mine) { this.sel = sq; this.dragFrom = sq; this.render(); }
    else if (!this.blind || !this.sel) { this.sel = null; this.render(); }
  }
  up(e) {
    if (this.locked || !this.dragFrom) return;
    const sq = this.sqAt(e);
    const from = this.dragFrom; this.dragFrom = null;
    if (sq && sq !== from) this.tryMove(from, sq);
  }

  async tryMove(from, to) {
    const legal = this.chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!legal.length) { this.sel = null; this.render(); return; }
    let promo;
    if (legal[0].promotion) promo = await this.askPromotion(this.chess.turn());
    this.sel = null;
    const uci = from + to + (promo || '');
    if (this.opts.onMove) {
      this.locked = true;
      const accept = await this.opts.onMove(uci, legal[0]);
      this.locked = false;
      if (accept === false) { this.render(); return; }
    } else this.play(uci);
  }

  askPromotion(color) {
    return new Promise((res) => {
      const ov = document.createElement('div');
      ov.className = 'promo window';
      ov.innerHTML = '<p>PROMOTE TO</p><div class="promo-row"></div>';
      for (const t of ['q', 'r', 'b', 'n']) {
        const b = document.createElement('button');
        b.innerHTML = `<img src="img/pieces/${color}${t.toUpperCase()}.svg" alt="${t}">`;
        b.onclick = () => { ov.remove(); res(t); };
        ov.querySelector('.promo-row').appendChild(b);
      }
      this.el.appendChild(ov);
    });
  }

  // Text list of pieces for blindfold mode
  pieceList() {
    const names = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: '' };
    const out = { w: [], b: [] };
    const order = 'kqrbnp';
    const all = [];
    this.chess.board().forEach((row) => row.forEach((p) => p && all.push(p)));
    all.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    for (const p of all) out[p.color].push(names[p.type] + p.square);
    return out;
  }
}
