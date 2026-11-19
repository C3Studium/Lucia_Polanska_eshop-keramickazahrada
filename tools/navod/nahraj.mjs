/**
 * Nahraje GIFy návodu ze scénářů v ./scenare (jen proti sandboxu).
 *
 *   node tools/navod/nahraj.mjs                 # všechny
 *   node tools/navod/nahraj.mjs produkt. sleva  # jen klíče, které obsahují text
 *
 * Výstup: tools/navod/.vystup/<klíč>.gif + manifest.json (klíč, oblast,
 * rozměry). Do backendu je pošle `nahrat.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { api, jenSandbox } from './lib/api.mjs';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

jenSandbox();
const ADMIN = process.env.CIL ?? 'http://localhost:9100';
const OBCHOD = process.env.OBCHOD ?? 'http://localhost:8100';
const VYSTUP = path.resolve(import.meta.dirname, '.vystup');
const filtr = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const scenare = [];
for (const f of fs.readdirSync(path.resolve(import.meta.dirname, 'scenare')).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')).sort()) {
  const mod = await import(pathToFileURL(path.resolve(import.meta.dirname, 'scenare', f)).href);
  for (const s of mod.default) scenare.push(s);
}
const vybrane = scenare.filter((s) => !filtr.length || filtr.some((f) => s.klic.includes(f)));
if (!vybrane.length) { console.log('Žádný scénář neodpovídá.'); process.exit(0); }

const manifestCesta = path.join(VYSTUP, 'manifest.json');
const manifest = fs.existsSync(manifestCesta) ? JSON.parse(fs.readFileSync(manifestCesta, 'utf8')) : {};

const p = await otevritProhlizec();
const prihlasenyAdmin = { hotovo: false };
const ctx = {
  ADMIN, OBCHOD, api, p,
  /** Přihlásí admin session v prohlížeči (jednou). */
  async admin(n) {
    if (prihlasenyAdmin.hotovo) return;
    await n.jdi(`${ADMIN}/app/login`, { pauza: 3000 });
    await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
    prihlasenyAdmin.hotovo = true;
  },
  data: {},
};

/* „Sandbox — Miska Zahrada" na GIFu mate — po dobu natáčení bez předpony
   (e2e.mjs hledá původní název, proto se na konci vrací). */
const { products: sandboxove } = await api('/admin/products?limit=50&fields=id,title&q=Sandbox');
const prejmenovane = sandboxove.filter((x) => x.title.startsWith('Sandbox — '));
for (const x of prejmenovane) await api(`/admin/products/${x.id}`, { title: x.title.replace('Sandbox — ', '') });
const vratitNazvy = async () => { for (const x of prejmenovane) await api(`/admin/products/${x.id}`, { title: x.title }).catch(() => undefined); };
process.on('SIGINT', async () => { await vratitNazvy(); process.exit(130); });

let ok = 0, chyba = 0;
await p.S('Network.clearBrowserCache');
for (const s of vybrane) {
  const n = new Nahravka(p, { sirka: s.sirka, celeOkno: s.celeOkno, vyrez: s.vyrez });
  const t0 = Date.now();
  let uklid = null;
  try {
    if (s.pred) uklid = await s.pred(ctx);
    await s.hrat(n, ctx, uklid);
    const r = await n.ulozit(path.join(VYSTUP, `${s.klic}.gif`), { konec: s.konec });
    manifest[s.klic] = { oblast: s.oblast, soubor: `${s.klic}.gif`, width: r.width, height: r.height, bytes: r.bytes, snimku: r.snimku, nahrano: new Date().toISOString() };
    fs.writeFileSync(manifestCesta, JSON.stringify(manifest, null, 2));
    ok++;
    console.log(`✓ ${s.klic}  ${r.width}×${r.height}  ${(r.bytes / 1024).toFixed(0)} kB  ${r.snimku} snímků  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } catch (e) {
    chyba++;
    console.log(`✗ ${s.klic}: ${e.message.split('\n')[0]}`);
    try { await n.ulozit(path.join(VYSTUP, '_chyby', `${s.klic}.gif`)); } catch { /* nic */ }
  } finally {
    if (s.po) await s.po(ctx, uklid).catch((e) => console.log(`  (úklid ${s.klic}: ${e.message.slice(0, 120)})`));
  }
}
if (p.chyby.length) console.log('Chyby ve stránce:', [...new Set(p.chyby)].slice(0, 5).join(' || '));
await p.zavrit();
await vratitNazvy();
console.log(`hotovo: ${ok} ✓, ${chyba} ✗`);
process.exit(chyba ? 1 : 0);
