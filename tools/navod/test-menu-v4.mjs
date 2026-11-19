/** Sandbox: nabídka „…" s Uložit vše / Zrušit vše + hromadný panel (ceny, bez skladu). */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';
import { api } from './lib/api.mjs';

const [out = 'C:/Users/ADMIN/AppData/Local/Temp/claude/8d6486bb6074ccad/b59cccbc-f5fd-462a-9d3e-ba030c6c2c96/scratchpad/menu-v4'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T1 = 'Keramická kytka bílá, kopretina, žlutý střed';
const T2 = 'Keramická kytka bílá, modrý střed';
const F = 'id,title,material,metadata,variants.id,variants.allow_backorder,variants.prices.amount,variants.prices.currency_code';
const najdi = async (t) => (await api(`/admin/products?q=${encodeURIComponent(t)}&fields=${F}`)).products.find((x) => x.title === t);
const p1 = await najdi(T1);
const p2 = await najdi(T2);
const zalohy = [p1, p2].map((p) => JSON.parse(JSON.stringify(p)));

const p = await otevritProhlizec({});
const n = new Nahravka(p, { celeOkno: true });
const foto = async (j) => { const r = await p.S('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, j + '.png'), Buffer.from(r.result.data, 'base64')); };
const ev = (x) => n.ev(x);
const tl = (t) => `[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(t)}) && b.getClientRects().length)`;
try {
  await n.jdi('http://localhost:9100/app/login', { pauza: 3000 });
  await ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
  await n.jdi('http://localhost:9100/app/produkty-workbench?hledat=kytka%20b%C3%ADl%C3%A1', { pauza: 3000, cekej: `document.querySelector('[aria-label="Možnosti produktu ${T1}"]')` });

  /* 1) Nabídka: rozpracovat, nic se neuloží */
  await ev(`(() => { const b = document.querySelector('[aria-label="Možnosti produktu ${T1}"]'); b.scrollIntoView({ block: 'center' }); b.click(); })()`); await sleep(2500);
  await ev(`(() => { const i = document.querySelector('[aria-label="Balné v Kč"]'); i.focus(); i.select(); })()`);
  await p.S('Input.insertText', { text: '17' }); await sleep(300);
  await ev(`document.querySelector('[aria-label="Křehké"]').click()`); await sleep(300);
  await ev(`(() => { const i = document.querySelector('[aria-label="Rozměry"]'); i.focus(); })()`);
  await p.S('Input.insertText', { text: 'výška 11 cm' }); await sleep(400);
  console.log('tlačítko:', await ev(`${tl('Uložit vše')}?.textContent.trim()`));
  const pred = await najdi(T1);
  console.log('před uložením v DB: balné', pred.metadata?.packaging_price, '| rozměry', pred.metadata?.dimensions, '| křehké', pred.metadata?.fragile);
  await foto('1-rozpracovano');
  /* Escape se neuložením nesmí zavřít */
  await p.S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await p.S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(800);
  console.log('po Escape nabídka otevřená:', await ev(`!!document.querySelector('[role=menu]')`), '| hláška:', await ev(`[...document.querySelectorAll('[data-sonner-toast]')].map(t => t.textContent.trim()).join(' / ').slice(0, 120)`));
  /* Zrušit vše */
  await ev(`${tl('Zrušit vše')}.click()`); await sleep(500);
  console.log('po Zrušit vše: balné =', await ev(`document.querySelector('[aria-label="Balné v Kč"]').value`), '| tlačítko:', await ev(`${tl('Uložit vše')}?.textContent.trim()`), '| disabled:', await ev(`${tl('Uložit vše')}?.disabled`));
  /* Znovu a Uložit vše */
  await ev(`(() => { const i = document.querySelector('[aria-label="Balné v Kč"]'); i.focus(); i.select(); })()`);
  await p.S('Input.insertText', { text: '17' }); await sleep(300);
  await ev(`document.querySelector('[aria-label="Mrazuvzdorné"]').click()`); await sleep(300);
  await ev(`${tl('Uložit vše')}.click()`); await sleep(2500);
  const po = await najdi(T1);
  console.log('po Uložit vše v DB: balné', po.metadata?.packaging_price, '| mrazuvzdorné', po.metadata?.frost_resistant, '| tlačítko:', await ev(`${tl('Uložit vše')}?.textContent.trim()`));
  await foto('2-ulozeno');
  await p.S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await p.S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(800);
  console.log('po uložení Escape zavře:', !(await ev(`!!document.querySelector('[role=menu]')`)));

  /* 2) Dva vybrané: „…" zmizí, lišta dole */
  await ev(`document.querySelector('[aria-label="Vybrat ${T1}"]').click()`); await sleep(300);
  console.log('1 vybraný: „…" vidět =', await ev(`getComputedStyle(document.querySelector('[aria-label="Možnosti produktu ${T1}"]')).visibility`), '| lišta =', await ev(`!!${tl('Hromadné změny')}`));
  await ev(`document.querySelector('[aria-label="Vybrat ${T2}"]').click()`); await sleep(500);
  console.log('2 vybrané: „…" vidět =', await ev(`getComputedStyle(document.querySelector('[aria-label="Možnosti produktu ${T1}"]')).visibility`), '| lišta =', await ev(`!!${tl('Hromadné změny')}`));
  await foto('3-dva-vybrane');

  /* 3) Hromadný panel: ceny + bez skladu */
  await ev(`${tl('Hromadné změny')}.click()`); await sleep(2500);
  const cenaPole = `document.querySelector('[role=dialog] input[aria-label="Cena — ${T2}"]')`;
  console.log('pole ceny:', await ev(`[...document.querySelectorAll('[role=dialog] input[aria-label^="Cena — "]')].map(i => i.getAttribute('aria-label') + '=' + i.value).join(' | ')`));
  await ev(`(() => { const i = ${cenaPole}; i.focus(); i.select(); })()`);
  await p.S('Input.insertText', { text: '777' }); await sleep(300);
  await ev(`[...document.querySelectorAll('[role=dialog] [aria-label="Objednání bez kusů na skladu"] button')].find(b => b.textContent.trim() === 'Ano').click()`); await sleep(400);
  const zp = `[...document.querySelectorAll('[role=dialog] input')].find(i => (i.placeholder || '').startsWith('např. Vyrobíme'))`;
  await ev(`${zp}.focus()`);
  await p.S('Input.insertText', { text: 'Vyrobíme do 3 týdnů.' }); await sleep(300);
  console.log('panel tlačítka:', await ev(`[...document.querySelectorAll('[role=dialog] button')].map(b => b.textContent.trim()).filter(t => /Uložit|Zrušit/.test(t)).join(' | ')`));
  await foto('4-hromadne');
  await ev(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim().startsWith('Uložit vše')).click()`); await sleep(4000);
  const q1 = await najdi(T1), q2 = await najdi(T2);
  console.log('po hromadném: cena T2 czk =', q2.variants.map((v) => v.prices.find((x) => x.currency_code === 'czk')?.amount).join(','), '| eur zůstalo =', q2.variants.map((v) => v.prices.find((x) => x.currency_code === 'eur')?.amount).join(','));
  console.log('bez skladu:', [...q1.variants, ...q2.variants].map((v) => v.allow_backorder).join(','), '| zpráva:', q1.metadata?.backorder_note, '/', q2.metadata?.backorder_note);
  if (p.chyby.length) console.log('chyby:', [...new Set(p.chyby)].slice(0, 2).map((c) => c.slice(0, 300)).join(' || '));
} finally {
  await p.zavrit();
  for (const z of zalohy) {
    const { product: ted } = await api(`/admin/products/${z.id}?fields=metadata`);
    const md = { ...(z.metadata ?? {}) };
    for (const k of Object.keys(ted.metadata ?? {})) if (!(k in md)) md[k] = '';
    await api(`/admin/products/${z.id}`, { material: z.material ?? null, metadata: md });
    await api(`/admin/products/${z.id}/variants/batch`, { update: z.variants.map((v) => ({ id: v.id, allow_backorder: Boolean(v.allow_backorder) })) });
    for (const v of z.variants) await api(`/admin/products/${z.id}/variants/${v.id}`, { prices: v.prices.map((x) => ({ currency_code: x.currency_code, amount: x.amount })) });
  }
  console.log('obnoveno');
}
