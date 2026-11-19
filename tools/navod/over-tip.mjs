/**
 * Kontrola okénka otazníku: najede myší na „?" (podle textu v aria-label),
 * vyfotí, pak klikne (připne), odjede a vyfotí znovu.
 *   node tools/navod/over-tip.mjs <složka> <cesta> <text otazníku> [akce před…]
 */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

const [out, cesta, tip, ...akce] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ADMIN = 'http://localhost:9100';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await otevritProhlizec({ width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) });
const n = new Nahravka(p);
const foto = async (jmeno) => { const r = await p.S('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, jmeno), Buffer.from(r.result.data, 'base64')); };
await n.jdi(`${ADMIN}/app/login`, { pauza: 3000 });
await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
await n.jdi(ADMIN + cesta, { pauza: 7000 });
for (const a of akce) { await n.ev(a); await sleep(1500); }
const bod = await n.ev(`(() => { const b = [...document.querySelectorAll('button[aria-label^="Návod: "]')].find(x => x.getAttribute('aria-label').includes(${JSON.stringify(tip)})); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
if (!bod) { console.log('otazník nenalezen'); process.exit(1); }
await p.S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bod.x, y: bod.y });
await sleep(1500);
const stav = () => n.ev(`(() => { const c = document.querySelector('[data-radix-popper-content-wrapper] [role=dialog], [data-radix-popper-content-wrapper] > div'); if (!c) return 'zavřeno'; const r = c.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight }; })()`);
console.log('po najetí:', JSON.stringify(await stav()));
await foto('najeti.png');
await p.S('Input.dispatchMouseEvent', { type: 'mousePressed', x: bod.x, y: bod.y, button: 'left', clickCount: 1 });
await p.S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bod.x, y: bod.y, button: 'left', clickCount: 1 });
await sleep(400);
await p.S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
await sleep(1200);
console.log('po kliku a odjetí:', JSON.stringify(await stav()));
await foto('pripnuto.png');
if (p.chyby.length) console.log('chyby:', p.chyby.slice(0, 3).join(' | '));
await p.zavrit();
