/** Sandbox: Hmotnost v nabídce „…" a v Hromadných změnách. */
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';
import { api } from './lib/api.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T1 = 'Keramická kytka bílá, kopretina, žlutý střed';
const T2 = 'Keramická kytka bílá, modrý střed';
const najdi = async (t) => (await api(`/admin/products?q=${encodeURIComponent(t)}&fields=id,title,weight`)).products.find((x) => x.title === t);
const p1 = await najdi(T1), p2 = await najdi(T2);
const zaloha = [p1, p2].map((p) => ({ id: p.id, weight: p.weight ?? null }));
const p = await otevritProhlizec({});
const n = new Nahravka(p, { celeOkno: true });
const ev = (x) => n.ev(x);
const tl = (t, s = 'document') => `[...${s}.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(t)}) && b.getClientRects().length)`;
try {
  await n.jdi('http://localhost:9100/app/login', { pauza: 3000 });
  await ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
  await n.jdi('http://localhost:9100/app/produkty-workbench?hledat=kytka%20b%C3%ADl%C3%A1', { pauza: 3000, cekej: `document.querySelector('[aria-label="Možnosti produktu ${T1}"]')` });
  /* nabídka */
  await ev(`document.querySelector('[aria-label="Možnosti produktu ${T1}"]').click()`); await sleep(2500);
  console.log('nabídka — pole Hmotnost:', await ev(`!!document.querySelector('[role=menu] [aria-label="Hmotnost v gramech"]')`), '| hodnota:', JSON.stringify(await ev(`document.querySelector('[aria-label="Hmotnost v gramech"]').value`)));
  await ev(`(() => { const i = document.querySelector('[aria-label="Hmotnost v gramech"]'); i.focus(); i.select(); })()`);
  await p.S('Input.insertText', { text: '450' }); await sleep(300);
  console.log('tlačítko:', await ev(`${tl('Uložit vše')}?.textContent.trim()`), '| fokus:', await ev(`document.activeElement?.getAttribute('aria-label')`));
  await ev(`${tl('Uložit vše')}.click()`); await sleep(2500);
  console.log('DB po nabídce:', (await najdi(T1)).weight);
  await p.S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await p.S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(700);
  /* hromadně */
  await ev(`document.querySelector('[aria-label="Vybrat ${T1}"]').click()`); await sleep(300);
  await ev(`document.querySelector('[aria-label="Vybrat ${T2}"]').click()`); await sleep(600);
  await ev(`${tl('Hromadné změny')}.click()`); await sleep(2500);
  const d = `document.querySelector('[role=dialog]')`;
  await ev(`(() => { const i = ${d}.querySelector('[aria-label="Hmotnost u všech vybraných"]'); i.focus(); })()`);
  await p.S('Input.insertText', { text: '300' }); await sleep(300);
  console.log('hromadně tlačítko:', await ev(`${tl('Uložit vše', d)}?.textContent.trim()`));
  await ev(`${tl('Uložit vše', d)}.click()`); await sleep(3500);
  console.log('DB po hromadných:', (await najdi(T1)).weight, (await najdi(T2)).weight);
  if (p.chyby.length) console.log('chyby:', [...new Set(p.chyby)].slice(0, 2).map((c) => c.slice(0, 300)).join(' || '));
} finally {
  await p.zavrit();
  for (const z of zaloha) await api(`/admin/products/${z.id}`, { weight: z.weight });
  console.log('obnoveno');
}
