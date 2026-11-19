/** Sandbox: nová nabídka „…" (okno vlevo), přehled doprav, hromadný materiál. */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec, tl, dialog, aria } from './lib/rekorder.mjs';
import { api } from './lib/api.mjs';

const [out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await otevritProhlizec();
const n = new Nahravka(p, { celeOkno: true });
const foto = async (jmeno) => { const r = await p.S('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, jmeno + '.png'), Buffer.from(r.result.data, 'base64')); };
const T1 = 'Keramická kytka přírodní, červený střed';
const T2 = 'Keramická kytka bílá, kopretina, žlutý střed';
const { products } = await api(`/admin/products?q=${encodeURIComponent('Keramická kytka')}&fields=id,title,material,metadata`);
const zaloha = products.map((x) => ({ id: x.id, material: x.material, dimensions: x.metadata?.dimensions ?? '', frost: x.metadata?.frost_resistant }));
await n.jdi('http://localhost:9100/app/login', { pauza: 3000 });
await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
try {
  /* 1) nabídka „…" */
  await n.jdi('http://localhost:9100/app/produkty-workbench?hledat=kytka', { pauza: 6000 });
  await n.ev(`document.querySelector('[aria-label="Možnosti produktu ${T1}"]').click()`); await sleep(900);
  console.log('nabídka:', await n.ev(`[...document.querySelectorAll('[role=menu] [role^=menuitem]')].map(b => b.querySelector('.txt-compact-small-plus')?.textContent.trim()).join(' | ')`));
  await foto('m1-nabidka');
  await n.ev(`[...document.querySelectorAll('[role=menu] [role^=menuitem]')].find(b => b.textContent.includes('Ceny a provedení')).click()`); await sleep(2500);
  console.log('po „Ceny a provedení": nabídka otevřená =', await n.ev(`!!document.querySelector('[role=menu]')`), '| okno vlevo =', await n.ev(`[...document.querySelectorAll('[data-radix-popper-content-wrapper] h3')].map(h => h.textContent.trim()).join(' / ')`));
  await foto('m2-ceny');
  await n.ev(`[...document.querySelectorAll('[role=menu] [role^=menuitem]')].find(b => b.textContent.includes('Povolené dopravy')).click()`); await sleep(2000);
  console.log('po „Povolené dopravy":', await n.ev(`[...document.querySelectorAll('[data-radix-popper-content-wrapper] h3')].map(h => h.textContent.trim()).join(' / ')`));
  await foto('m3-dopravy');
  await n.ev(`[...document.querySelectorAll('[role=menu] [role^=menuitem]')].find(b => b.textContent.includes('Bez slevových kódů')).click()`); await sleep(2000);
  console.log('přepínač „Bez slevových kódů" po kliku:', await n.ev(`[...document.querySelectorAll('[role=menu] [role=menuitemcheckbox]')].find(b => b.textContent.includes('Bez slevových')).getAttribute('aria-checked')`), '| nabídka otevřená =', await n.ev(`!!document.querySelector('[role=menu]')`));
  await n.ev(`[...document.querySelectorAll('[role=menu] [role^=menuitem]')].find(b => b.textContent.includes('Bez slevových kódů')).click()`); await sleep(1500);
  await p.S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(800);
  console.log('Esc zavřel nabídku:', await n.ev(`!document.querySelector('[role=menu]')`));

  /* 2) přehled doprav na detailu */
  await n.jdi(`http://localhost:9100/app/produkt/${products.find((x) => x.title === T1).id}`, { pauza: 6000 });
  console.log('přehled doprav:', await n.ev(`(() => { const r = document.querySelector('[aria-label^="Jak se dá výrobek poslat"]'); if (!r) return 'nenalezen'; r.scrollIntoView({ block: 'center' }); return [...r.querySelectorAll('span[title]')].map(s => (s.className.includes('line-through') ? '✗ ' : '✓ ') + s.textContent.trim()).join(' | '); })()`));
  await sleep(500); await foto('m4-prehled');

  /* 3) hromadně materiál + rozměry + mráz */
  await n.jdi('http://localhost:9100/app/produkty-workbench?hledat=kytka', { pauza: 6000 });
  for (const t of [T1, T2]) { await n.ev(`document.querySelector('[aria-label="Vybrat ${t}"]').click()`); await sleep(300); }
  await sleep(600);
  await n.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Hromadné změny').click()`); await sleep(1500);
  await n.ev(`(() => { const s = document.querySelector('[role=dialog] select[aria-label="Materiál"]'); const o = [...s.options].find(o => !o.value.startsWith('__')) ?? s.options[1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return o.value; })()`);
  await n.ev(`(() => { const i = document.querySelector('[role=dialog] input[aria-label="Rozměry"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'průměr 12 cm'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(500);
  await n.ev(`document.querySelector('[role=dialog] select[aria-label="Materiál"]').scrollIntoView({ block: 'center' })`); await sleep(400);
  await foto('m5-hromadne');
  await n.ev(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim().startsWith('Uložit vše')).click()`); await sleep(4000);
  const { products: po } = await api(`/admin/products?q=${encodeURIComponent('Keramická kytka')}&fields=id,title,material,metadata`);
  for (const x of po.filter((x) => [T1, T2].includes(x.title))) console.log('uloženo:', x.title, '| materiál:', x.material, '| rozměry:', x.metadata?.dimensions);
  if (p.chyby.length) console.log('chyby:', [...new Set(p.chyby)].slice(0, 3).map((c) => c.slice(0, 200)).join(' || '));
} finally {
  await p.zavrit();
  for (const z of zaloha) await api(`/admin/products/${z.id}`, { material: z.material ?? null, metadata: { dimensions: z.dimensions } }).catch(() => undefined);
}
