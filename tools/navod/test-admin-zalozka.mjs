/** Sandbox: titulek a ikona záložky administrace. */
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await otevritProhlizec({});
const n = new Nahravka(p, { celeOkno: true });
try {
  await n.jdi('http://localhost:9100/app/login', { pauza: 3000 });
  console.log('přihlášení:', await n.ev('document.title'));
  await n.ev(`(async () => { const r = await fetch('/auth/user/emailpass', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }) }); const { token } = await r.json(); await fetch('/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + token } }); return 1; })()`);
  for (const cesta of ['/app/prehled', '/app/orders', '/app/produkty-workbench']) {
    await n.jdi('http://localhost:9100' + cesta, { pauza: 4000 });
    await sleep(800);
    console.log(cesta, '→', JSON.stringify(await n.ev('document.title')));
  }
  console.log('ikona:', await n.ev(`(document.querySelector('link[rel=icon]')?.href || '').slice(0, 40)`));
} finally {
  await p.zavrit();
}
