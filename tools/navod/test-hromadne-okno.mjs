/** Sandbox: okno Hromadné změny — počítač a telefon, fokus při psaní, zavírání s neuloženým. */
import fs from 'node:fs';
import path from 'node:path';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

const out = 'C:/Users/ADMIN/AppData/Local/Temp/claude/8d6486bb6074ccad/b59cccbc-f5fd-462a-9d3e-ba030c6c2c96/scratchpad/hromadne-okno';
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T1 = 'Keramická kytka bílá, kopretina, žlutý střed';
const T2 = 'Keramická kytka bílá, modrý střed';

const beh = async (telefon) => {
  const p = await otevritProhlizec(telefon ? { width: 390, height: 844 } : {});
  if (telefon) await p.S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const n = new Nahravka(p, { celeOkno: true });
  const ev = (x) => n.ev(x);
  const foto = async (j) => { const r = await p.S('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, (telefon ? 'tel-' : '') + j + '.png'), Buffer.from(r.result.data, 'base64')); };
  try {
    await n.jdi('http://localhost:9100/app/login', { pauza: 3000 });
    await ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
    await n.jdi('http://localhost:9100/app/produkty-workbench?hledat=kytka%20b%C3%ADl%C3%A1', { pauza: 3000, cekej: `document.querySelector('[aria-label="Vybrat ${T1}"]')` });
    await ev(`document.querySelector('[aria-label="Vybrat ${T1}"]').click()`); await sleep(300);
    await ev(`document.querySelector('[aria-label="Vybrat ${T2}"]').click()`); await sleep(600);
    await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Hromadné změny').click()`); await sleep(2500);
    const d = `document.querySelector('[role=dialog]')`;
    console.log(telefon ? '[telefon]' : '[počítač]', 'okno:', await ev(`(() => { const r = ${d}.getBoundingClientRect(); return Math.round(r.width) + '×' + Math.round(r.height) + ' vodorovný posun stránky: ' + (document.documentElement.scrollWidth > innerWidth); })()`));
    await ev(`(() => { const i = ${d}.querySelector('input[aria-label="Cena — ${T2}"]'); i.focus(); i.select(); })()`);
    for (const ch of ['8', '8', '0']) { await p.S('Input.insertText', { text: ch }); await sleep(120); }
    console.log('fokus v ceně:', await ev(`document.activeElement?.getAttribute('aria-label')`), '| hodnota:', await ev(`${d}.querySelector('input[aria-label="Cena — ${T2}"]').value`));
    await p.S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await p.S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(600);
    console.log('Escape s neuloženým: okno zůstalo =', await ev(`!!${d}`), '| hláška:', await ev(`[...document.querySelectorAll('[data-sonner-toast]')].map(t => t.textContent.trim()).join(' / ').slice(0, 90)`));
    await foto('1-okno');
    await ev(`[...${d}.querySelectorAll('button')].find(b => b.textContent.trim() === 'Zrušit vše').click()`); await sleep(800);
    console.log('po Zrušit vše: okno =', await ev(`!!${d}`));
    if (p.chyby.length) console.log('chyby:', [...new Set(p.chyby)].slice(0, 2).map((c) => c.slice(0, 300)).join(' || '));
  } finally {
    await p.zavrit();
  }
};
await beh(false);
await beh(true);
