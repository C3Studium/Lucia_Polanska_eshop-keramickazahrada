/**
 * Produkční admin: je v menu „Návod" a otevře se /app/navod?  (jen čtení)
 *   EMAIL=… HESLO=… node tools/navod/over-produkce.mjs <složka>
 */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

const [out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ADMIN = 'https://admin.keramickazahrada.cz';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await otevritProhlizec({ izolovane: true });
const n = new Nahravka(p, { celeOkno: true });
await p.S('Network.setCacheDisabled', { cacheDisabled: true });
await n.jdi(`${ADMIN}/app/login`, { pauza: 5000 });
console.log('přihlášení:', await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ${JSON.stringify(process.env.EMAIL)}, password: ${JSON.stringify(process.env.HESLO)} }) }); const { token } = await r.json(); const s = await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return s.status; })()`));
await n.jdi(`${ADMIN}/app/prehled`, { pauza: 8000 });
console.log('menu:', await n.ev(`[...document.querySelectorAll('nav a, aside a')].map(a => a.textContent.trim()).filter(Boolean).join(' | ')`));
await n.jdi(`${ADMIN}/app/navod`, { pauza: 8000 });
console.log('/app/navod nadpis:', await n.ev(`[...document.querySelectorAll('h1,h2')].map(h => h.textContent.trim()).slice(0, 4).join(' · ')`));
const r = await p.S('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(out, 'produkce-navod.png'), Buffer.from(r.result.data, 'base64'));
console.log('otazníky na přehledu:', await n.ev(`document.querySelectorAll('button[aria-label^="Návod: "]').length`));
await p.zavrit();
