// Loads the bundled game data once, and combines the puzzle sources.
import { state } from './store.js';

const cache = {};
async function get(name) {
  if (!cache[name]) cache[name] = fetch(`data/${name}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return cache[name];
}

function story(meta) {
  if (!meta) return null;
  const [white, black, year, event] = meta.split('|');
  return { white, black, year, event };
}

async function load(name, source) {
  const key = '_' + name;
  if (!cache[key]) {
    cache[key] = get(name).then((raw) => raw.map(([id, fen, moves, rating, themes, meta]) =>
      ({ id, fen, moves, rating, themes, source, story: story(meta) })));
  }
  return cache[key];
}
export const masters = () => load('masters', 'master');
export const lichess = () => load('puzzles', 'lichess');
export function mine() { return (state().custom || []).map((p) => ({ ...p, source: 'mine' })); }

// Puzzles from the sources switched on in Options (falls back so there's always something)
export async function puzzles() {
  const src = state().settings.sources;
  let pool = [];
  if (src.masters) pool = pool.concat(await masters());
  if (src.lichess) pool = pool.concat(await lichess());
  if (src.mine) pool = pool.concat(mine());
  if (pool.length < 50) {
    // too few to train with: quietly add the other bundled sets
    if (!src.masters) pool = pool.concat(await masters());
    if (pool.length < 50 && !src.lichess) pool = pool.concat(await lichess());
  }
  return pool;
}
export async function puzzleById(id) {
  const all = [...(await masters()), ...(await lichess()), ...mine()];
  return all.find((p) => p.id === id);
}
export const course = () => get('course');
export const extra = () => get('extra');
export const eco = () => get('eco');
