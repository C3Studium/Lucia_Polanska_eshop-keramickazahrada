/**
 * Test nabídky „…" v řádku Produkty+ (sandbox): otevře nabídku, klikne na
 * každou položku a zapíše, co se stalo (panel / hláška / nic). Mezi
 * položkami zavře, co se otevřelo. Mazání a archivaci jen otevře, nepotvrdí.
 */
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';
import { api } from './lib/api.mjs';

const TITUL = process.argv[2] ?? 'Keramická kytka přírodní, červený střed';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await otevritProhlizec();
const n = new Nahravka(p, { celeOkno: true });
await n.jdi('http://localhost:9100/app/login', { pauza: 3000 });
await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
const url = `http://localhost:9100/app/produkty-workbench?hledat=${encodeURIComponent(TITUL.split(',')[0])}`;
const { products } = await api(`/admin/products?q=${encodeURIComponent(TITUL)}&fields=id,title,status,metadata`);
const pred = products.find((x) => x.title === TITUL);
const otevritMenu = async () => {
  await n.jdi(url, { pauza: 5000 });
  const r = await n.ev(`(() => { const b = document.querySelector('[aria-label="Možnosti produktu ${TITUL}"]'); if (!b) return false; b.click(); return true; })()`);
  await sleep(800);
  return r;
};
await otevritMenu();
const polozky = await n.ev(`[...document.querySelectorAll('[role=menuitem]')].map(m => m.textContent.trim())`);
console.log('položky:', polozky.join(' | '));
for (const nazev of polozky) {
  if (/Smazat|Archivovat|Skrýt z obchodu|Zobrazit v obchodě|Otevřít v obchodě/.test(nazev)) { console.log(`- ${nazev}: (přeskočeno — nevratné/odkaz)`); continue; }
  await otevritMenu();
  const predDialog = await n.ev(`document.querySelectorAll('[role=dialog]').length`);
  const ok = await n.ev(`(() => { const m = [...document.querySelectorAll('[role=menuitem]')].find(m => m.textContent.trim() === ${JSON.stringify(nazev)}); if (!m) return false; m.click(); return true; })()`);
  await sleep(1800);
  const stav = await n.ev(`({ dialogu: document.querySelectorAll('[role=dialog]').length, nadpis: [...document.querySelectorAll('[role=dialog] h1, [role=dialog] h2, [role=dialog] [class*=Title]')].map(h => h.textContent.trim()).join(' / ').slice(0, 80), toast: [...document.querySelectorAll('[data-sonner-toast], [role=status]')].map(t => t.textContent.trim()).join(' / ').slice(0, 100), popover: !!document.querySelector('[data-radix-popper-content-wrapper]') })`);
  console.log(`- ${nazev}: klik=${ok} dialogů ${predDialog}→${stav.dialogu} ${stav.nadpis ? '„' + stav.nadpis + '"' : ''} ${stav.popover ? '[okénko]' : ''} ${stav.toast ? 'hláška: ' + stav.toast : ''}`);
  await n.klavesa('Escape', { po: 300 });
}
if (p.chyby.length) console.log('chyby:', [...new Set(p.chyby)].slice(0, 3).map((c) => c.slice(0, 300)).join(' || '));
await p.zavrit();
/* vrátit případné přepnuté příznaky */
if (pred) await api(`/admin/products/${pred.id}`, { metadata: Object.fromEntries(Object.entries(pred.metadata ?? {})), status: pred.status }).catch(() => undefined);
