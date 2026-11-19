/**
 * Průzkum stránek pro psaní scénářů: snímek + nadpisy, tlačítka, záložky.
 *   node tools/navod/pruzkum.mjs <výstupní složka> /app/prehled /app/objednavky …
 */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

const [out, ...cesty] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ADMIN = process.env.CIL ?? 'http://localhost:9100';
const OBCHOD = process.env.OBCHOD ?? 'http://localhost:8100';
const p = await otevritProhlizec({ izolovane: process.env.IZOL === '1', ...(process.env.IZOL === '1' ? { width: 1280, height: 800 } : {}) });
const n = new Nahravka(p);
await n.jdi(`${ADMIN}/app/login`, { pauza: 3000 });
await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
for (const c of cesty) {
  const url = c.startsWith('http') ? c : c.startsWith('/cz') ? OBCHOD + c : ADMIN + c;
  await n.jdi(url, { pauza: 6000 });
  const jmeno = c.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
  const r = await p.S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: Math.min(3000, await n.ev('document.documentElement.scrollHeight')), scale: 0.6 } });
  if (r.result) fs.writeFileSync(path.join(out, jmeno + '.png'), Buffer.from(r.result.data, 'base64'));
  const info = await n.ev(`(() => {
    const vis = (e) => e.getClientRects().length;
    const t = (e) => e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 70);
    const main = document.querySelector('main') ?? document.body;
    return {
      h: [...main.querySelectorAll('h1,h2,h3')].filter(vis).map(t).slice(0, 40),
      tab: [...main.querySelectorAll('[role=tab]')].filter(vis).map(t),
      btn: [...new Set([...main.querySelectorAll('button,a')].filter(vis).map(t).filter(Boolean))].slice(0, 120),
      tip: [...main.querySelectorAll('[aria-label]')].filter(vis).map(e => e.getAttribute('aria-label')).slice(0, 40),
    };
  })()`);
  fs.writeFileSync(path.join(out, jmeno + '.json'), JSON.stringify(info, null, 1));
  console.log('✓', c, '| h:', info.h.slice(0, 6).join(' · '));
}
await p.zavrit();
