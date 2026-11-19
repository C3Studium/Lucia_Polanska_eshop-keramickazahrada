/**
 * Kontrola otazníků: projde stránky, klikne na „?“ a vyfotí panel.
 *   node tools/navod/kontrola.mjs <složka> <cesta> [<cesta>…]
 * Cesta může mít za # výraz, který se před focením vyhodnotí (např. otevření panelu).
 */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

const [out, ...cesty] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ADMIN = process.env.CIL ?? 'http://localhost:9100';
const OBCHOD = process.env.OBCHOD ?? 'http://localhost:8100';
const p = await otevritProhlizec({ dark: process.env.DARK === '1' });
const n = new Nahravka(p);
await n.jdi(`${ADMIN}/app/login`, { pauza: 3000 });
await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
let i = 0;
for (const c of cesty) {
  const [cesta, ...akce] = c.split('#!');
  const url = cesta.startsWith('/cz') ? OBCHOD + cesta : ADMIN + cesta;
  await n.jdi(url, { pauza: 6000 });
  for (const a of akce) { await n.ev(a).catch((e) => console.log('akce selhala', e.message.slice(0, 100))); await new Promise((r) => setTimeout(r, 1500)); }
  const tipy = await n.ev(`[...document.querySelectorAll('button[aria-label^="Návod: "]')].map(b => b.getAttribute('aria-label'))`);
  console.log(cesta, '→ otazníky:', tipy.join(' | ') || '—');
  const r = await p.S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(out, `k${++i}.png`), Buffer.from(r.result.data, 'base64'));
  if (tipy.length) {
    await n.ev(`(() => { const all = [...document.querySelectorAll('button[aria-label^="Návod: "]')]; const b = all.find(x => x.getAttribute('aria-label').includes(${JSON.stringify(process.env.TIP ?? '')})) ?? all[0]; b.scrollIntoView({ block: 'center' }); b.click(); })()`);
    await new Promise((r) => setTimeout(r, 2500));
    const r2 = await p.S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(out, `k${i}-tip.png`), Buffer.from(r2.result.data, 'base64'));
  }
}
if (p.chyby.length) console.log('chyby:', [...new Set(p.chyby)].slice(0, 5).join(' || '));
await p.zavrit();
