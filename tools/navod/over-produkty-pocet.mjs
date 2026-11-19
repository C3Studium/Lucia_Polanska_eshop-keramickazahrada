/**
 * Produkce: ukazuje Produkty+ (bez hledání) celý katalog? Čte jen, nic nemění.
 *   CIL=https://admin.keramickazahrada.cz EMAIL=… HESLO=… node tools/navod/over-produkty-pocet.mjs
 */
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

const CIL = process.env.CIL ?? 'http://127.0.0.1:9100';
const hledane = ['Sasanka Japonská', 'Pestřec půlnoční', 'Keramická růže střední'];
const p = await otevritProhlizec({ izolovane: true });
const n = new Nahravka(p, { celeOkno: true });
try {
  await n.jdi(`${CIL}/app/login`, { pauza: 3000 });
  await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${JSON.stringify({ email: process.env.EMAIL, password: process.env.HESLO })}) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
  await n.jdi(`${CIL}/app/produkty-workbench`, { pauza: 6000, cekej: `document.querySelector('[aria-label^="Vybrat "]')` });
  const radku = await n.ev(`document.querySelectorAll('[aria-label^="Vybrat "]:not([aria-label*="všech"])').length`);
  const pocet = await n.ev(`[...document.querySelectorAll('main *')].map(e => e.textContent.trim()).find(t => /^\\d+ (produkt|produkty|produktů)$/.test(t)) ?? '?'`);
  console.log('řádků v seznamu:', radku, '| popisek:', pocet);
  for (const h of hledane) console.log(h, '→', await n.ev(`[...document.querySelectorAll('main a, main p, main span')].some(e => e.textContent.includes(${JSON.stringify(h)}))`));
} finally {
  await p.zavrit();
}
