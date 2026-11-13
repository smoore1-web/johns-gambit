// Loads the bundled game data once.
const cache = {};
async function get(name) {
  if (!cache[name]) cache[name] = fetch(`data/${name}.json`).then((r) => r.json());
  return cache[name];
}

export async function puzzles() {
  const raw = await get('puzzles');
  if (!raw._idx) {
    raw._idx = raw.map(([id, fen, moves, rating, themes]) => ({ id, fen, moves, rating, themes }));
    raw._byId = Object.fromEntries(raw._idx.map((p) => [p.id, p]));
  }
  return raw._idx;
}
export async function puzzleById(id) { await puzzles(); return cache.puzzles.then((r) => r._byId[id]); }
export const course = () => get('course');
export const extra = () => get('extra');
export async function eco() {
  const raw = await get('eco');
  return raw;
}
