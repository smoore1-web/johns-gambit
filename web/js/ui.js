// Small UI helpers: element builder, router, toasts and retro sounds.
import { state } from './store.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function win(title, ...kids) {
  return h('section', { class: 'window' }, title ? h('div', { class: 'title-sm' }, title) : null, ...kids);
}

// Command list with blinking cursor: items = [{label, sub, onClick}]
export function menu(items) {
  return h('nav', { class: 'menu' }, items.filter(Boolean).map((it) =>
    h('button', { onClick: () => { sfx('select'); it.onClick(); }, disabled: it.disabled },
      h('span', { class: 'cur', 'aria-hidden': 'true' }, '▶'), it.label,
      it.sub != null ? h('span', { class: 'sub' }, it.sub) : null)));
}
export function cmd(label, onClick, attrs = {}) {
  return h('button', { class: 'cmd', onClick: () => { sfx('select'); onClick(); }, ...attrs }, label);
}

// ---------- router ----------
const screens = {};
const stack = [];
let root, cleanup = null;
export function register(name, fn) { screens[name] = fn; }
export function mount(el) { root = el; }
export function go(name, params = {}, replace = false) {
  if (replace) stack.pop();
  stack.push({ name, params });
  show();
}
export function back() {
  if (stack.length <= 1) return false;
  stack.pop();
  show();
  return true;
}
export function home() { stack.length = 0; go('map'); }
export function refresh() { show(); }
function show() {
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  const top = stack[stack.length - 1];
  root.innerHTML = '';
  const el = h('div', { class: 'screen' });
  root.appendChild(el);
  const token = {};
  show.token = token;
  const r = screens[top.name](el, top.params || {});
  if (typeof r === 'function') cleanup = r;
  else if (r && typeof r.then === 'function') {
    r.then((fn) => {
      if (typeof fn !== 'function') return;
      if (show.token === token) cleanup = fn; else { try { fn(); } catch (e) { /* */ } }
    });
  }
  el.scrollTop = 0;
}

export function toast(text, ms = 1600) {
  const t = h('div', { class: 'toast window tight' }, text);
  root.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---------- retro sounds (generated, no files) ----------
let ac = null;
function tone(freq, start, dur, type = 'square', vol = 0.06) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  o.connect(g).connect(ac.destination);
  o.start(ac.currentTime + start); o.stop(ac.currentTime + start + dur + 0.02);
}
export function sfx(kind) {
  if (!state().settings.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    switch (kind) {
      case 'move': tone(220, 0, 0.05, 'triangle', 0.12); break;
      case 'capture': tone(160, 0, 0.07, 'square', 0.08); break;
      case 'select': tone(880, 0, 0.03, 'square', 0.03); break;
      case 'good': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.1)); break;
      case 'bad': tone(196, 0, 0.12, 'sawtooth', 0.05); tone(147, 0.12, 0.2, 'sawtooth', 0.05); break;
      case 'level': [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.09)); break;
      case 'tick': tone(1200, 0, 0.02, 'square', 0.02); break;
    }
  } catch (e) { /* audio unavailable */ }
}
