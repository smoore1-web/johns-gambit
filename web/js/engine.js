// Stockfish (lite, single-threaded WebAssembly) running offline in a worker.

let worker = null;
let ready = null;
let queue = Promise.resolve();
let listener = null;

function boot() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    try {
      worker = new Worker('engine/stockfish-19-lite-single.js');
    } catch (e) { reject(e); return; }
    worker.onmessage = (ev) => {
      const line = typeof ev.data === 'string' ? ev.data : '';
      if (line === 'uciok') worker.postMessage('isready');
      else if (line === 'readyok' && resolve) { const r = resolve; resolve = null; r(); }
      if (listener) listener(line);
    };
    worker.onerror = (e) => reject(e);
    worker.postMessage('uci');
  });
  return ready;
}

export function warmUp() { boot().catch(() => {}); }

// Returns {move: 'e2e4', score: {cp|mate}, pv: [...]}
// opts: {movetime, depth, skill (0-20)}
export function analyse(fen, opts = {}) {
  const job = queue.then(() => boot()).then(() => new Promise((resolve) => {
    let last = { score: null, pv: [] };
    listener = (line) => {
      if (line.startsWith('info') && line.includes(' pv ')) {
        const m = line.match(/score (cp|mate) (-?\d+)/);
        const pv = line.split(' pv ')[1].trim().split(' ');
        if (m && !line.includes('lowerbound') && !line.includes('upperbound')) {
          last = { score: { [m[1]]: parseInt(m[2], 10) }, pv };
        }
      } else if (line.startsWith('bestmove')) {
        listener = null;
        const move = line.split(' ')[1];
        resolve({ move: move === '(none)' ? null : move, score: last.score, pv: last.pv });
      }
    };
    worker.postMessage('ucinewgame');
    worker.postMessage(`setoption name Skill Level value ${opts.skill ?? 20}`);
    worker.postMessage(`position fen ${fen}`);
    if (opts.depth) worker.postMessage(`go depth ${opts.depth}`);
    else worker.postMessage(`go movetime ${opts.movetime ?? 700}`);
  }));
  queue = job.catch(() => {});
  return job;
}

export function stop() { if (worker) worker.postMessage('stop'); }
