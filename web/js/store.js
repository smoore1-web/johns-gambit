// Saved progress: rating, XP, streak, spaced-repetition cards, weakness stats.
// Everything lives on the phone (localStorage).

const KEY = 'johns-gambit-save-v1';
const DAY = 86400000;

const fresh = () => ({
  v: 1,
  rating: 1200,
  rated: 0,            // number of rated puzzles played
  xp: 0,
  streak: { count: 0, last: null, best: 0 },
  cards: {},           // spaced repetition: key -> {i, e, due, reps, lapses, last}
  themes: {},          // weakness tracker: theme -> {a: attempts, s: clean solves}
  seen: {},            // puzzle id -> 1
  records: { rush3: 0, rush5: 0, solved: 0, hardest: 0, cleanRun: 0, bestCleanRun: 0, endgames: 0, lines: 0 },
  repertoire: { white: [], black: [] },
  history: [],         // [{d: 'YYYY-MM-DD', ok, fail}] last 60 days
  settings: { explain: 'auto', sound: true, coords: true, sessionMin: 10, blindMode: 'hidden', night: false, music: true, musicVol: 0.5, sources: { masters: true, lichess: false, mine: true } },
  custom: [],          // puzzles you added yourself
  badges: {},
});

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return deepMerge(fresh(), JSON.parse(raw));
  } catch (e) { /* storage unavailable or corrupted: start fresh */ }
  return fresh();
}
function deepMerge(base, over) {
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      base[k] = deepMerge(base[k], over[k]);
    } else base[k] = over[k];
  }
  return base;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
}
export const state = () => S;
export function exportJSON() { return JSON.stringify(S); }
export function importJSON(text) {
  const obj = JSON.parse(text);
  if (!obj || obj.v !== 1) throw new Error('Not a John\'s Gambit backup');
  S = deepMerge(fresh(), obj); save();
}
export function resetAll() { S = fresh(); save(); }

// ---------- dates & streak ----------
export function today(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function touchStreak() {
  const t = today();
  const st = S.streak;
  if (st.last === t) return;
  const y = today(Date.now() - DAY);
  st.count = st.last === y ? st.count + 1 : 1;
  st.last = t;
  st.best = Math.max(st.best, st.count);
}
export function currentStreak() {
  const st = S.streak;
  if (!st.last) return 0;
  if (st.last === today() || st.last === today(Date.now() - DAY)) return st.count;
  return 0;
}
function logDay(ok) {
  const t = today();
  let h = S.history[S.history.length - 1];
  if (!h || h.d !== t) { h = { d: t, ok: 0, fail: 0 }; S.history.push(h); }
  if (ok) h.ok++; else h.fail++;
  if (S.history.length > 60) S.history.shift();
}

// ---------- XP & level ----------
export function addXP(n) { S.xp += n; }
export function level() { return Math.floor(Math.sqrt(S.xp / 40)) + 1; }
export function levelProgress() {
  const l = level();
  const lo = 40 * (l - 1) ** 2, hi = 40 * l ** 2;
  return (S.xp - lo) / (hi - lo);
}

// ---------- spaced repetition ----------
// grade: 0 = failed, 1 = solved with help, 2 = solved cleanly
export function review(key, grade, meta) {
  const now = Date.now();
  const c = S.cards[key] || { i: 0, e: 2.4, due: now, reps: 0, lapses: 0 };
  if (meta) c.m = meta;
  if (grade === 0) {
    c.lapses++; c.i = 0; c.e = Math.max(1.3, c.e - 0.2);
    c.due = now + 10 * 60000;            // back again in 10 minutes
  } else if (grade === 1) {
    c.e = Math.max(1.3, c.e - 0.15);
    c.i = c.i < 1 ? 1 : Math.max(1, Math.round(c.i * 1.2));
    c.due = now + c.i * DAY;
  } else {
    c.i = c.i < 1 ? 1 : c.i < 3 ? 3 : Math.round(c.i * c.e);
    c.due = now + c.i * DAY;
  }
  c.reps++; c.last = now;
  S.cards[key] = c;
  touchStreak(); logDay(grade > 0);
  save();
  return c;
}
export function due(prefix, at = Date.now()) {
  return Object.entries(S.cards)
    .filter(([k, c]) => (!prefix || k.startsWith(prefix)) && c.due <= at)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k, c]) => ({ key: k, ...c }));
}
export function dueCount(prefix) { return due(prefix).length; }
export function card(key) { return S.cards[key]; }
export function mastered(prefix) {
  return Object.entries(S.cards).filter(([k, c]) => k.startsWith(prefix) && c.i >= 7).length;
}

// ---------- rating (Elo against the puzzle's rating) ----------
export function ratePuzzle(puzzleRating, score) {
  const k = S.rated < 20 ? 48 : S.rated < 60 ? 32 : 20;
  const exp = 1 / (1 + 10 ** ((puzzleRating - S.rating) / 400));
  const delta = Math.round(k * (score - exp));
  S.rating = Math.max(400, S.rating + delta);
  S.rated++;
  return delta;
}

// ---------- weakness tracker ----------
export function recordThemes(themes, clean) {
  for (const t of themes) {
    const x = S.themes[t] || (S.themes[t] = { a: 0, s: 0 });
    x.a++; if (clean) x.s++;
  }
}
export function themeRate(t) {
  const x = S.themes[t];
  return x && x.a ? x.s / x.a : null;
}
// Themes sorted weakest first (needs at least 3 attempts to count)
export function weakThemes(allowed) {
  return Object.entries(S.themes)
    .filter(([t, x]) => x.a >= 3 && (!allowed || allowed.includes(t)))
    .map(([t, x]) => ({ t, a: x.a, rate: x.s / x.a }))
    .sort((a, b) => a.rate - b.rate);
}

export function markSeen(id) { S.seen[id] = 1; }
export function wasSeen(id) { return !!S.seen[id]; }

export function badge(id) {
  if (S.badges[id]) return false;
  S.badges[id] = Date.now(); save();
  return true;
}
