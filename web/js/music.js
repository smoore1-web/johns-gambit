// Original chiptune soundtrack for John's Gambit, played live with WebAudio (no audio files).
// Each song is written on an 8th-note grid: a note name starts a note, "-" holds it, "." is a rest.
// Drum lanes use k = kick, s = snare, h = hi-hat.

const SONGS = {
  // "The Gambit Begins" — heroic title theme in C major
  title: {
    bpm: 116,
    lead: `E5 . G5 . C6 - B5 A5  G5 - E5 . C5 . D5 E5  F5 . A5 . C6 - B5 A5  G5 - - - . . G5 A5
           B5 . G5 . D6 - C6 B5  A5 - F5 . D5 . E5 F5  G5 . E5 . C6 - B5 D6  C6 - - - . . . .`,
    pad: `E4 - - - - - - -  E4 - - - - - - -  F4 - - - - - - -  D4 - - - - - - -
          D4 - - - - - - -  F4 - - - - - - -  E4 - - - D4 - - -  E4 - - - - - - -`,
    bass: `C3 . C3 G2 C3 . C3 G2  A2 . A2 E2 A2 . A2 E2  F2 . F2 C3 F2 . F2 C3  G2 . G2 D3 G2 . B2 .
           G2 . G2 D3 G2 . G2 D3  D3 . D3 A2 D3 . D3 A2  C3 . C3 G2 G2 . G2 B2  C3 . G2 . C3 . . .`,
    drums: 'k h s h k k s h',
  },
  // "Across the Realm" — gentle world-map wander in G major
  map: {
    bpm: 92,
    lead: `G4 . B4 . D5 - - B4  C5 - A4 . - . . .  B4 . D5 . G5 - F#5 E5  D5 - - - . . . .
           E5 . D5 . B4 - A4 G4  A4 - B4 . C5 . . .  B4 . A4 . F#4 - - A4  G4 - - - . . . .`,
    arp: `G3 B3 D4 B3 G3 B3 D4 B3  C4 E4 G4 E4 C4 E4 G4 E4  G3 B3 D4 B3 G3 B3 D4 B3  D4 F#4 A4 F#4 D4 F#4 A4 F#4
          E4 G4 B4 G4 E4 G4 B4 G4  A3 C4 E4 C4 A3 C4 E4 C4  D4 F#4 A4 F#4 D4 F#4 A4 F#4  G3 B3 D4 B3 G3 B3 D4 B3`,
    bass: `G2 - - - D3 - - -  C3 - - - G2 - - -  G2 - - - D3 - - -  D3 - - - A2 - - -
           E2 - - - B2 - - -  A2 - - - C3 - - -  D3 - - - F#2 - - -  G2 - - - D3 - - -`,
    drums: '. . h . . . h .',
    soft: true,
  },
  // "Deep Thought" — calm, sparse theme for solving and studying (A minor)
  think: {
    bpm: 76,
    lead: `A4 - - - E5 - - -  D5 - C5 - B4 - - -  C5 - - - G4 - - -  A4 - - - - - - -
           F4 - - - C5 - - -  B4 - A4 - G4 - - -  A4 - E4 - G#4 - - -  A4 - - - - - - -`,
    arp: `A3 C4 E4 A4 E4 C4 A3 C4  G3 B3 D4 G4 D4 B3 G3 B3  C4 E4 G4 C5 G4 E4 C4 E4  A3 C4 E4 A4 E4 C4 A3 C4
          F3 A3 C4 F4 C4 A3 F3 A3  E3 G3 B3 E4 B3 G3 E3 G3  E3 G#3 B3 E4 B3 G#3 E3 G#3  A3 C4 E4 A4 E4 C4 A3 C4`,
    bass: `A2 - - - - - - -  G2 - - - - - - -  C3 - - - - - - -  A2 - - - - - - -
           F2 - - - - - - -  E2 - - - - - - -  E2 - - - - - - -  A2 - - - - - - -`,
    soft: true,
    leadWave: 'triangle',
  },
  // "Against the Clock" — driving Rush Arena theme in E minor
  rush: {
    bpm: 150,
    lead: `E5 . E5 G5 . E5 B5 A5  G5 . F#5 . E5 . D5 .  C5 . E5 . G5 . A5 B5  B5 - A5 - G5 - F#5 -
           E5 . E5 G5 . E5 B5 D6  C6 . B5 . A5 . G5 .  A5 . G5 . F#5 . D5 F#5  E5 - - - . . . .`,
    bass: `E2 E2 E3 E2 E2 E2 E3 E2  E2 E2 E3 E2 E2 E2 E3 E2  C2 C2 C3 C2 C2 C2 C3 C2  D2 D2 D3 D2 D2 D2 D3 D2
           E2 E2 E3 E2 E2 E2 E3 E2  A2 A2 A3 A2 A2 A2 A3 A2  D2 D2 D3 D2 D2 D2 D3 D2  E2 E2 E3 E2 E2 E2 E3 E2`,
    drums: 'k h s h k k s h',
  },
  // "The Castle Walls" — slow, stately endgame theme in D minor
  castle: {
    bpm: 84,
    lead: `D5 - - - F5 - E5 D5  C#5 - - - A4 - - -  D5 - F5 - A5 - G5 F5  E5 - - - - - . .
           F5 - - - E5 - D5 C5  Bb4 - - - D5 - - -  E5 - D5 - C#5 - E5 -  D5 - - - - - . .`,
    pad: `A4 - - - - - - -  E4 - - - - - - -  A4 - - - - - - -  C#5 - - - - - - -
          A4 - - - - - - -  F4 - - - - - - -  G4 - - - E4 - - -  F4 - - - - - - -`,
    bass: `D3 - - - A2 - - -  A2 - - - E2 - - -  D3 - - - F2 - - -  A2 - - - C#3 - - -
           D3 - - - F2 - - -  Bb2 - - - F2 - - -  A2 - - - A2 - - -  D3 - - - A2 - - -`,
    drums: 'k . . . s . . .',
    soft: true,
  },
};

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function freq(name) {
  const m = name.match(/^([A-G][#b]?)(\d)$/);
  if (!m) return null;
  const midi = 12 * (parseInt(m[2], 10) + 1) + NOTE[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}
// turn a lane string into [{step, len, f}] events
function parse(lane) {
  const toks = lane.trim().split(/\s+/);
  const ev = [];
  let cur = null;
  toks.forEach((t, i) => {
    if (t === '-') { if (cur) cur.len++; return; }
    cur = null;
    if (t === '.') return;
    if ('ksh'.includes(t)) { ev.push({ step: i, len: 1, drum: t }); return; }
    const f = freq(t);
    if (f) { cur = { step: i, len: 1, f }; ev.push(cur); }
  });
  return { ev, steps: toks.length };
}

let ac = null, master = null, noiseBuf = null;
let song = null, songId = null, timer = null, startAt = 0, nextStep = 0, lanes = null;
let enabled = true, volume = 0.5;

function ctx() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = volume * 0.6;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ac;
}

function voice(f, t, dur, wave, vol, decay = true) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = wave; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  if (decay) g.gain.exponentialRampToValueAtTime(vol * 0.35, t + Math.min(0.25, dur * 0.6));
  g.gain.setValueAtTime(decay ? vol * 0.35 : vol, t + dur * 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function drum(kind, t, soft) {
  const v = soft ? 0.5 : 1;
  if (kind === 'k') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.35 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.16);
    return;
  }
  const src = ac.createBufferSource(); src.buffer = noiseBuf;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass';
  hp.frequency.value = kind === 'h' ? 7000 : 1500;
  const g = ac.createGain();
  const len = kind === 'h' ? 0.04 : 0.12;
  g.gain.setValueAtTime((kind === 'h' ? 0.05 : 0.14) * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(hp).connect(g).connect(master); src.start(t); src.stop(t + len + 0.01);
}

function schedule() {
  const stepDur = 60 / song.bpm / 2;
  while (startAt + nextStep * stepDur < ac.currentTime + 0.15) {
    const t = startAt + nextStep * stepDur;
    for (const ln of lanes) {
      const s = nextStep % ln.steps;
      for (const e of ln.byStep[s] || []) {
        if (e.drum) drum(e.drum, t, song.soft);
        else voice(e.f, t, e.len * stepDur * 0.95, ln.wave, ln.vol, ln.decay);
      }
    }
    nextStep++;
  }
}

function load(id) {
  song = SONGS[id];
  const mk = (key, wave, vol, decay) => {
    if (!song[key]) return null;
    const p = parse(song[key]);
    const byStep = {};
    for (const e of p.ev) (byStep[e.step] = byStep[e.step] || []).push(e);
    return { steps: p.steps, byStep, wave, vol, decay };
  };
  const soft = song.soft ? 0.7 : 1;
  lanes = [
    mk('lead', song.leadWave || 'square', 0.05 * soft, true),
    mk('pad', 'triangle', 0.05 * soft, false),
    mk('arp', 'square', 0.018 * soft, true),
    mk('bass', 'triangle', 0.11 * soft, false),
    mk('drums', null, 1, false),
  ].filter(Boolean);
}

export function play(id) {
  if (id === songId && timer) return;
  stopNow();
  songId = id;
  if (!enabled || !id || !SONGS[id]) return;
  try {
    ctx();
    if (ac.state === 'suspended') ac.resume();
    load(id);
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(0.0001, ac.currentTime);
    master.gain.linearRampToValueAtTime(volume * 0.6, ac.currentTime + 0.6);
    startAt = ac.currentTime + 0.1; nextStep = 0;
    timer = setInterval(schedule, 40);
    schedule();
  } catch (e) { /* audio unavailable */ }
}
function stopNow() {
  if (timer) { clearInterval(timer); timer = null; }
  if (ac && master) {
    // fade out what's already scheduled, then a fresh output for the next song
    const old = master;
    old.gain.cancelScheduledValues(ac.currentTime);
    old.gain.setValueAtTime(old.gain.value, ac.currentTime);
    old.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.25);
    setTimeout(() => { try { old.disconnect(); } catch (e) { /* */ } }, 600);
    master = ac.createGain(); master.gain.value = volume * 0.6; master.connect(ac.destination);
  }
}
export function stop() { stopNow(); songId = null; }
export function setEnabled(on) {
  enabled = on;
  if (!on) { const id = songId; stopNow(); songId = id; } else if (songId) { const id = songId; songId = null; play(id); }
}
export function setVolume(v) {
  volume = v;
  if (master && ac) master.gain.setValueAtTime(volume * 0.6, ac.currentTime);
}
export function current() { return songId; }
// Pause when the app goes to the background
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend(); else if (enabled && songId) ac.resume();
});

// Which song plays on which screen
const SCREEN_SONG = {
  title: 'title', map: 'map', camp: 'map', hall: 'map', options: 'map',
  rush: 'rush', rushplay: 'rush',
  endgames: 'castle', endgame: 'castle',
};
export function songFor(screen) { return SCREEN_SONG[screen] || 'think'; }
