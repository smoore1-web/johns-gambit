#!/usr/bin/env python3
"""Writes web/sw.js listing every game file, so the website works fully offline.
Usage: make_sw.py VERSION"""
import os, sys
version = sys.argv[1] if len(sys.argv) > 1 else 'dev'
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'web'))
files = []
for root, _, fs in os.walk('.'):
    for f in fs:
        p = os.path.join(root, f)[2:]
        if p == 'sw.js' or p.endswith('.txt'):
            continue
        files.append(p)
files.sort()
lst = ',\n  '.join(f"'{p}'" for p in ['./'] + files)
open('sw.js', 'w').write(f"""// Offline support for the website version: keeps every game file on the device.
const CACHE = 'johns-gambit-{version}';
const FILES = [
  {lst}
];
self.addEventListener('install', (e) => {{
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});
// Serve from the device first; refresh in the background when online.
self.addEventListener('fetch', (e) => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async (c) => {{
    const hit = await c.match(e.request, {{ ignoreSearch: true }});
    const net = fetch(e.request).then((r) => {{ if (r.ok) c.put(e.request, r.clone()); return r; }}).catch(() => hit);
    return hit || net;
  }}));
}});
""")
print(f'sw.js lists {len(files)} files (version {version})')
