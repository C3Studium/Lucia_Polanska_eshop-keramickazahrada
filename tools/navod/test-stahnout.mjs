/** Sandbox: stažení fotky výrobku (API + klik v adminu do složky). */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';
import { api, prihlasit } from './lib/api.mjs';

const [out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const token = await prihlasit();
const { products } = await api(`/admin/products?q=${encodeURIComponent('Keramické pítko s vlnitým')}&fields=id,title,thumbnail,images.url`);
const p0 = products[0];
const url = p0.images[0].url;
const r = await fetch(`http://127.0.0.1:9100/admin/workbench/stahnout?url=${encodeURIComponent(url)}&nazev=Keramické pítko 1`, { headers: { authorization: 'Bearer ' + token } });
console.log('API povolená:', r.status, r.headers.get('content-type'), r.headers.get('content-disposition'), (await r.arrayBuffer()).byteLength, 'B');
const zle = await fetch(`http://127.0.0.1:9100/admin/workbench/stahnout?url=${encodeURIComponent('https://example.com/a.jpg')}`, { headers: { authorization: 'Bearer ' + token } });
console.log('API cizí adresa:', zle.status, (await zle.json()).message);

const p = await otevritProhlizec();
const n = new Nahravka(p, { celeOkno: true });
const slozka = path.resolve(out, 'stazene');
fs.mkdirSync(slozka, { recursive: true });
for (const f of fs.readdirSync(slozka)) fs.rmSync(path.join(slozka, f));
await p.S('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: slozka }).catch(() => undefined);
await p.S('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: slozka }).catch(() => undefined);
await n.jdi('http://localhost:9100/app/login', { pauza: 3000 });
await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
await n.jdi(`http://localhost:9100/app/produkt/${p0.id}`, { pauza: 7000 });
await n.ev(`document.querySelector('[aria-label^="Fotka 1"]')?.click()`);
await new Promise((r) => setTimeout(r, 1500));
const shot = await p.S('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(out, 'viewer.png'), Buffer.from(shot.result.data, 'base64'));
console.log('tlačítko ve zvětšené fotce:', await n.ev(`[...document.querySelectorAll('[role=dialog] button')].some(b => b.textContent.trim() === 'Stáhnout')`));
await n.ev(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Stáhnout')?.click()`);
await new Promise((r) => setTimeout(r, 4000));
console.log('staženo do složky:', fs.readdirSync(slozka).map((f) => `${f} (${fs.statSync(path.join(slozka, f)).size} B)`).join(', ') || 'nic');
if (p.chyby.length) console.log('chyby:', p.chyby.slice(0, 2).join(' | '));
await p.zavrit();
