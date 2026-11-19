/**
 * Kontrola otazníku v obchodě (izolovaný profil): najetí myší (počítač)
 * nebo ťuknutí (telefon), fotka.
 *   node tools/navod/over-tip-obchod.mjs <složka> <cesta> <text otazníku> [telefon]
 */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

const [out, cesta, tip, rezim] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const telefon = rezim === 'telefon';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await otevritProhlizec({ izolovane: true, width: telefon ? 390 : 1280, height: telefon ? 844 : 800 });
if (telefon) {
  await p.S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await p.S('Emulation.setTouchEmulationEnabled', { enabled: true });
}
const n = new Nahravka(p, { celeOkno: true });
if (process.env.KOSIK) await p.S('Network.setCookie', { name: '_medusa_cart_id', value: process.env.KOSIK, domain: 'localhost', path: '/' });
await n.jdi((process.env.OBCHOD_URL ?? 'http://localhost:8100') + cesta, { pauza: 9000 });
await n.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Odmítnout vše')?.click()`);
await sleep(1200);
const bod = await n.ev(`(() => { const b = [...document.querySelectorAll('button[aria-label^="Nápověda: "]')].find(x => x.getAttribute('aria-label').includes(${JSON.stringify(tip)})); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
console.log('otazníky:', await n.ev(`[...document.querySelectorAll('button[aria-label^="Nápověda: "]')].map(b => b.getAttribute('aria-label')).join(' | ')`));
if (!bod) { console.log('otazník nenalezen'); await p.zavrit(); process.exit(1); }
await sleep(600);
if (telefon) {
  await p.S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bod.x, y: bod.y }] });
  await p.S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
} else {
  await p.S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bod.x, y: bod.y });
}
await sleep(2500);
console.log('okno:', await n.ev(`(() => { const o = document.querySelector('.navod-okno'); if (!o) return 'zavřeno'; const r = o.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), druh: o.dataset.druh, gif: !!o.querySelector('img') }; })()`));
const r = await p.S('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(out, (telefon ? 'telefon-' : '') + tip.replace(/\W+/g, '_') + '.png'), Buffer.from(r.result.data, 'base64'));
if (p.chyby.length) console.log('chyby:', p.chyby.slice(0, 3).map((c) => c.slice(0, 1500)).join(' | '));
await p.zavrit();
