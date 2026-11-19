/** Sandbox: nabídka „…" v3 — počítač i telefon. */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';
import { api } from './lib/api.mjs';

const [out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T1 = 'Keramická kytka bílá, kopretina, žlutý střed';
const { products } = await api(`/admin/products?q=${encodeURIComponent(T1)}&fields=id,title,material,metadata`);
const pr = products.find((x) => x.title === T1);
const zaloha = { material: pr.material, metadata: { ...(pr.metadata ?? {}) } };

const beh = async (telefon) => {
  const p = await otevritProhlizec(telefon ? { width: 390, height: 844 } : {});
  if (telefon) await p.S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const n = new Nahravka(p, { celeOkno: true });
  const foto = async (j) => { const r = await p.S('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, (telefon ? 'tel-' : '') + j + '.png'), Buffer.from(r.result.data, 'base64')); };
  await n.jdi('http://localhost:9100/app/login', { pauza: 3000 });
  await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
  await n.jdi('http://localhost:9100/app/produkty-workbench?hledat=kopretina', { pauza: 3000, cekej: `document.querySelector('[aria-label="Možnosti produktu ${T1}"]')` });
  await n.ev(`(() => { const b = document.querySelector('[aria-label="Možnosti produktu ${T1}"]'); b.scrollIntoView({ block: 'center' }); b.click(); })()`); await sleep(2500);
  const rozmer = await n.ev(`(() => { const m = document.querySelector('[role=menu]'); if (!m) return null; const r = m.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), scroll: m.querySelector('.overflow-y-auto') ? m.querySelector('.overflow-y-auto').scrollHeight > m.querySelector('.overflow-y-auto').clientHeight : false }; })()`);
  console.log(telefon ? '[telefon]' : '[počítač]', 'nabídka:', JSON.stringify(rozmer));
  await foto('1-nabidka');
  if (!telefon) {
    /* psaní do Balné — zůstane fokus? */
    await n.ev(`(() => { const i = document.querySelector('[aria-label="Balné v Kč"]'); i.focus(); i.select(); })()`);
    for (const ch of ['1', '5']) { await p.S('Input.insertText', { text: ch }); await sleep(150); }
    console.log('fokus v Balné po psaní:', await n.ev(`document.activeElement?.getAttribute('aria-label')`), '| hodnota:', await n.ev(`document.querySelector('[aria-label="Balné v Kč"]').value`));
    await n.ev(`document.querySelector('[aria-label="Balné v Kč"]').blur()`); await sleep(1500);
    await n.ev(`(() => { const i = document.querySelector('[aria-label="Rozměry"]'); i.focus(); })()`);
    for (const ch of ['vý', 'ška', ' 10']) { await p.S('Input.insertText', { text: ch }); await sleep(150); }
    console.log('fokus v Rozměry:', await n.ev(`document.activeElement?.getAttribute('aria-label')`), '| hodnota:', await n.ev(`document.querySelector('[aria-label="Rozměry"]').value`));
    await n.ev(`document.querySelector('[aria-label="Rozměry"]').blur()`); await sleep(1500);
    await n.ev(`[...document.querySelectorAll('[role=radiogroup][aria-label="Typ výrobku"] button')].find(b => b.textContent.includes('Poškozený')).click()`); await sleep(1800);
    console.log('typ po kliku Poškozený:', await n.ev(`[...document.querySelectorAll('[role=radiogroup][aria-label="Typ výrobku"] button')].find(b => b.getAttribute('aria-checked') === 'true')?.textContent`), '| nabídka otevřená:', await n.ev(`!!document.querySelector('[role=menu]')`));
    console.log('hláška:', await n.ev(`[...document.querySelectorAll('[data-sonner-toast]')].map(t => t.textContent.trim()).join(' / ').slice(0, 160)`));
    await api(`/admin/workbench/products/${pr.id}/flags`, { clearance: false });
    await n.jdi('http://localhost:9100/app/produkty-workbench?hledat=kopretina', { pauza: 3000, cekej: `document.querySelector('[aria-label="Možnosti produktu ${T1}"]')` });
    await n.ev(`document.querySelector('[aria-label="Možnosti produktu ${T1}"]').click()`); await sleep(2000);
  }
  await n.ev(`[...document.querySelectorAll('[role=menu] [role=menuitem]')].find(b => b.textContent.includes('Ceny a provedení')).click()`); await sleep(2500);
  console.log('po „Ceny a provedení": okno =', await n.ev(`[...document.querySelectorAll('[data-radix-popper-content-wrapper] h3')].map(h => h.textContent.trim()).join(' / ')`), '| nabídka vidět =', await n.ev(`!!document.querySelector('[role=menu]')`), '| Zpět =', await n.ev(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Zpět do nabídky'))`));
  await foto('2-okno');
  if (telefon) {
    await n.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Zpět do nabídky')).click()`); await sleep(1200);
    console.log('po Zpět: nabídka vidět =', await n.ev(`!!document.querySelector('[role=menu]')`));
  }
  if (p.chyby.length) console.log('chyby:', [...new Set(p.chyby)].slice(0, 2).map((c) => c.slice(0, 300)).join(' || '));
  await p.zavrit();
};
try {
  await beh(false);
  await beh(true);
  const { product: po } = await api(`/admin/products/${pr.id}?fields=material,metadata`);
  console.log('uloženo: balné', po.metadata?.packaging_price, '| rozměry', po.metadata?.dimensions, '| poškozený', po.metadata?.clearance);
} finally {
  const { product: ted } = await api(`/admin/products/${pr.id}?fields=metadata`);
  const md = { ...zaloha.metadata };
  for (const k of Object.keys(ted.metadata ?? {})) if (!(k in md)) md[k] = '';
  await api(`/admin/products/${pr.id}`, { material: zaloha.material ?? null, metadata: md });
}
