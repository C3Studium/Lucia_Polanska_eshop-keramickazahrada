/** Sandbox: projde každou volbu nové nabídky „…" a zachytí pády (chyby stránky). */
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

const T1 = process.argv[2] ?? 'Keramická kytka přírodní, červený střed';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await otevritProhlizec();
const n = new Nahravka(p, { celeOkno: true });
const logy = [];
p.onEvent((m) => { if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logy.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400)); });
await p.S('Runtime.enable');
await n.jdi('http://localhost:9100/app/login', { pauza: 3000 });
await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
const otevrit = async () => {
  await n.jdi('http://localhost:9100/app/produkty-workbench?hledat=kytka', { pauza: 3000, cekej: `document.querySelector('[aria-label="Možnosti produktu ${T1}"]')` });
  await n.ev(`document.querySelector('[aria-label="Možnosti produktu ${T1}"]').click()`); await sleep(900);
};
await otevrit();
const volby = await n.ev(`[...document.querySelectorAll('[role=menu] [role^=menuitem]')].map(b => b.querySelector('.txt-compact-small-plus')?.textContent.trim().replace(/[›‹]/g, '').trim())`);
for (const v of volby ?? []) {
  if (/Smazat|Archivovat|Skrýt|Zobrazit|Otevřít/.test(v)) continue;
  await otevrit();
  p.chyby.length = 0; logy.length = 0;
  await n.ev(`[...document.querySelectorAll('[role=menu] [role^=menuitem]')].find(b => b.textContent.includes(${JSON.stringify(v)}))?.click()`);
  await sleep(2500);
  const pad = await n.ev(`document.body.innerText.includes('Something went wrong') || document.body.innerText.includes('Nastala chyba') || document.body.innerText.includes('Unexpected')`);
  console.log(`${v}: ${pad ? 'PÁD' : 'ok'} ${p.chyby[0] ? '| ' + p.chyby[0].slice(0, 300) : ''} ${logy[0] ? '| log: ' + logy[0].slice(0, 300) : ''}`);
}
await p.zavrit();
