// "Why" notes after a puzzle, written at three levels that grow with the player.
import { Chess } from './vendor/chess.js';

const NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const THEME_LABEL = {
  fork: 'Fork', pin: 'Pin', skewer: 'Skewer', discoveredAttack: 'Discovered attack',
  doubleCheck: 'Double check', hangingPiece: 'Hanging piece', backRankMate: 'Back-rank mate',
  smotheredMate: 'Smothered mate', mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3',
  deflection: 'Deflection', attraction: 'Attraction', decoy: 'Decoy', sacrifice: 'Sacrifice',
  clearance: 'Clearance', interference: 'Interference', xRayAttack: 'X-ray attack',
  trappedPiece: 'Trapped piece', zugzwang: 'Zugzwang', promotion: 'Promotion',
  advancedPawn: 'Advanced pawn', capturingDefender: 'Remove the defender', intermezzo: 'In-between move',
  quietMove: 'Quiet move', defensiveMove: 'Defensive move', rookEndgame: 'Rook endgame',
  pawnEndgame: 'Pawn endgame', queenEndgame: 'Queen endgame', bishopEndgame: 'Bishop endgame',
  knightEndgame: 'Knight endgame', exposedKing: 'Exposed king', kingsideAttack: 'Kingside attack',
  queensideAttack: 'Queenside attack', attackingF2F7: 'Attacking f2/f7', anastasiaMate: "Anastasia's mate",
  arabianMate: 'Arabian mate', bodenMate: "Boden's mate", doubleBishopMate: 'Double bishop mate',
  hookMate: 'Hook mate', dovetailMate: 'Dovetail mate', enPassant: 'En passant',
  underPromotion: 'Underpromotion', castling: 'Castling', mate: 'Checkmate', crushing: 'Crushing',
  advantage: 'Advantage', endgame: 'Endgame', middlegame: 'Middlegame', opening: 'Opening',
};

// Which theme to talk about first (most specific idea wins)
const PRIORITY = ['smotheredMate', 'backRankMate', 'anastasiaMate', 'arabianMate', 'bodenMate', 'hookMate',
  'dovetailMate', 'doubleBishopMate', 'doubleCheck', 'fork', 'skewer', 'pin', 'discoveredAttack',
  'xRayAttack', 'deflection', 'attraction', 'decoy', 'capturingDefender', 'interference', 'clearance',
  'trappedPiece', 'intermezzo', 'zugzwang', 'underPromotion', 'promotion', 'advancedPawn', 'enPassant',
  'hangingPiece', 'quietMove', 'defensiveMove', 'sacrifice', 'mateIn1', 'mateIn2', 'mateIn3', 'mate',
  'attackingF2F7', 'exposedKing', 'kingsideAttack', 'queensideAttack'];

export function mainTheme(themes) {
  for (const t of PRIORITY) if (themes.includes(t)) return t;
  return themes.find((t) => THEME_LABEL[t] && !['crushing', 'advantage', 'endgame', 'middlegame', 'opening', 'short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM'].includes(t)) || null;
}

const IDEA = {
  fork: 'one piece attacks two targets at once, and only one can be saved',
  pin: 'a piece can\'t move without exposing something more valuable behind it',
  skewer: 'the valuable piece in front must move, and the piece behind it falls',
  discoveredAttack: 'moving one piece uncovers an attack from the piece behind it',
  doubleCheck: 'two pieces give check at once, so the king is forced to move',
  hangingPiece: 'a piece is left undefended and can simply be taken',
  backRankMate: 'the king is trapped behind its own pawns on the back rank',
  smotheredMate: 'the king is boxed in by its own pieces and a knight delivers mate',
  deflection: 'a defender is lured away from the square it was guarding',
  attraction: 'an enemy piece (often the king) is forced onto a bad square',
  decoy: 'an enemy piece is lured onto a square where it gets hit',
  capturingDefender: 'taking the piece that guards a target leaves the target unprotected',
  interference: 'a piece is dropped between an enemy piece and what it defends',
  clearance: 'a piece moves out of the way to open a line or square for another',
  xRayAttack: 'a piece attacks through another piece along the same line',
  trappedPiece: 'an enemy piece has no safe squares left',
  intermezzo: 'an in-between move (often a check) comes before the expected recapture',
  zugzwang: 'the opponent would be fine if they could pass, but every move makes things worse',
  promotion: 'a pawn reaches the last rank and becomes a new queen (or another piece)',
  underPromotion: 'promoting to a piece other than a queen is the strongest choice',
  advancedPawn: 'a far-advanced pawn is too strong to stop',
  quietMove: 'a calm, non-capturing move sets up an unstoppable threat',
  defensiveMove: 'the best move is a precise defence that stops the opponent\'s threat',
  sacrifice: 'giving up material opens the way to something bigger',
  mate: 'the moves force checkmate',
  attackingF2F7: 'f2/f7 is guarded only by the king early on, so it\'s a natural target',
  exposedKing: 'the king has lost its pawn cover and is open to attack',
  enPassant: 'the en passant capture is the key move',
};

// Replays the solution and works out what happened, for concrete notes.
function analyse(puzzle) {
  const c = new Chess(puzzle.fen);
  const moves = puzzle.moves.split(' ');
  c.move(uciObj(moves[0]));
  const me = c.turn();
  const startMat = material(c);
  const first = c.move(uciObj(moves[1]));
  const firstSan = first.san;
  const piece = first.piece;
  // Enemy pieces attacked by the moved piece right after the key move
  const targets = [];
  for (const row of c.board()) for (const p of row) {
    if (p && p.color !== me && (p.type === 'k' || VAL[p.type] >= 3)) {
      if (c.attackers(p.square, me).includes(first.to)) targets.push(p);
    }
  }
  const sans = [firstSan];
  for (let i = 2; i < moves.length; i++) { const m = c.move(uciObj(moves[i])); sans.push(m.san); }
  const endMat = material(c);
  const mated = c.isCheckmate();
  const gain = (endMat[me] - endMat[me === 'w' ? 'b' : 'w']) - (startMat[me] - startMat[me === 'w' ? 'b' : 'w']);
  return { me, firstSan, piece, captured: first.captured, check: /[+#]/.test(first.san), targets, sans, mated, gain, plies: moves.length - 1 };
}
function uciObj(u) { return { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }; }
function material(c) {
  const m = { w: 0, b: 0 };
  for (const row of c.board()) for (const p of row) if (p) m[p.color] += VAL[p.type];
  return m;
}
function list(arr) { return arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]; }
function gainText(g) {
  if (g >= 9) return 'a whole queen\'s worth of material';
  if (g >= 5) return 'a rook\'s worth of material';
  if (g >= 3) return 'a piece';
  if (g >= 1) return g === 1 ? 'a pawn' : `${g} pawns' worth of material`;
  return null;
}

export function levelFor(rating, setting) {
  if (setting && setting !== 'auto') return setting;
  return rating < 1200 ? 'beginner' : rating < 1700 ? 'intermediate' : 'advanced';
}

export function explain(puzzle, level) {
  const themes = puzzle.themes.split(' ');
  const t = mainTheme(themes);
  let a;
  try { a = analyse(puzzle); } catch (e) { return { title: 'NICE!', text: 'Well solved.' }; }
  const pc = NAME[a.piece];
  const tgt = a.targets.map((p) => NAME[p.type]);
  const line = a.sans.join(' ');
  const g = gainText(a.gain);
  const label = t ? THEME_LABEL[t] : 'Tactic';
  let text;

  if (level === 'beginner') {
    if (a.mated && a.plies === 1) text = `${a.firstSan} is checkmate! The king is in check and has no safe square to run to.`;
    else if (a.mated) text = `${a.firstSan} starts a forced checkmate. Every reply loses: ${line}.`;
    else if (t === 'fork' && tgt.length >= 2) text = `Your ${pc} attacks the ${list(tgt)} at the same time. That's called a fork. They can only save one, so you win ${g || 'material'}.`;
    else if (t && IDEA[t]) text = `This is a ${label.toLowerCase()}: ${IDEA[t]}. ${a.firstSan} is the key move${g ? `, and you win ${g}` : ''}.`;
    else text = `${a.firstSan} is the strongest move${g ? ` and wins ${g}` : ''}.`;
  } else if (level === 'intermediate') {
    if (a.mated) text = `${a.plies === 1 ? `${a.firstSan} mates at once.` : `${a.firstSan}${a.check ? '' : ', a quiet move,'} forces mate: ${line}.`}${t && IDEA[t] && !t.startsWith('mate') ? ` The pattern: ${IDEA[t]}.` : ''}`;
    else if (t === 'fork' && tgt.length >= 2) text = `${a.firstSan} forks the ${list(tgt)}.${a.check ? ' Because it\'s check, there\'s no time to save both.' : ''} The line ${line} nets ${g || 'material'}.`;
    else text = `${label}: ${IDEA[t] || 'the forcing line wins'}. ${line}${g ? ` wins ${g}` : ''}.`;
  } else {
    const tags = themes.filter((x) => THEME_LABEL[x] && !['crushing', 'advantage', 'short', 'long', 'oneMove', 'veryLong', 'middlegame', 'opening', 'endgame'].includes(x)).map((x) => THEME_LABEL[x]);
    if (a.mated) text = `${line} — forced mate. Motifs: ${list(tags) || label}.${a.captured ? ` ${a.firstSan} removes a key defender.` : ''}`;
    else text = `${line}. ${label}${tgt.length >= 2 ? ` hitting the ${list(tgt)}` : ''}; net gain ≈ ${a.gain > 0 ? '+' + a.gain : a.gain}. Motifs: ${list(tags) || label}.`;
  }
  if (!a.mated && themes.includes('mate')) text += ' The attack leads to a forced checkmate.';
  return { title: label.toUpperCase(), text };
}

// Three hints that each give away a bit more
export function hints(puzzle) {
  const themes = puzzle.themes.split(' ');
  const t = mainTheme(themes);
  const moves = puzzle.moves.split(' ');
  const c = new Chess(puzzle.fen);
  c.move(uciObj(moves[0]));
  const key = moves[1];
  const p = c.get(key.slice(0, 2));
  const h1 = t && IDEA[t]
    ? `Look for a ${THEME_LABEL[t].toUpperCase()}: ${IDEA[t]}.`
    : (themes.includes('mate') ? 'There is a forced checkmate here. Look at checks first.' : 'Look for checks, captures and threats.');
  return [
    { text: h1 },
    { text: `The ${NAME[p.type]} on ${key.slice(0, 2)} makes the key move.`, square: key.slice(0, 2) },
    { text: `Move it to ${key.slice(2, 4)}.`, from: key.slice(0, 2), to: key.slice(2, 4) },
  ];
}
