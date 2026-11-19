/** Sandbox: dokumenty objednávky — API (s tokenem i bez) a stránka potvrzené objednávky. */
import fs from 'node:fs';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';
import { api, CIL, jenSandbox } from './lib/api.mjs';

jenSandbox();
const orderId = process.argv[2];
const zeme = process.argv[3] ?? 'sk';
const OBCHOD = process.env.OBCHOD ?? 'http://localhost:8100';
const out = 'C:/Users/ADMIN/AppData/Local/Temp/claude/8d6486bb6074ccad/b59cccbc-f5fd-462a-9d3e-ba030c6c2c96/scratchpad/dokumenty.png';
const { api_keys } = await api('/admin/api-keys?type=publishable&fields=token,revoked_at&limit=10');
const pk = api_keys.find((k) => !k.revoked_at).token;
const st = (p) => fetch(CIL + p, { headers: { 'x-publishable-api-key': pk } }).then(async (r) => ({ s: r.status, j: await r.json().catch(() => ({})) }));

const bez = await st(`/store/orders/${orderId}/documents`);
console.log('bez tokenu:', bez.s, bez.j?.message ?? '');
const cizi = await st(`/store/orders/${orderId}/documents?token=spatny`);
console.log('špatný token:', cizi.s);
const { j: ss } = await st(`/store/orders/${orderId}/self-service`);
const s = await st(`/store/orders/${orderId}/documents?token=${encodeURIComponent(ss.token ?? '')}`);
console.log('s tokenem:', s.s);
for (const d of s.j.documents ?? []) {
  const head = await fetch(d.url, { method: 'GET' }).then((r) => `${r.status} ${r.headers.get('content-type') ?? ''}`).catch((e) => 'nedostupné: ' + e.message);
  console.log(`  • ${d.title}${d.note ? ' — ' + d.note : ''} → ${d.filename} [${head}]`);
}

const p = await otevritProhlizec({ izolovane: true, width: Number(process.env.SIRKA ?? 1280), height: 1000 });
if (process.env.SIRKA) await p.S('Emulation.setDeviceMetricsOverride', { width: Number(process.env.SIRKA), height: 844, deviceScaleFactor: 2, mobile: true });
const n = new Nahravka(p, { celeOkno: true });
try {
  await n.jdi(`${OBCHOD}/${zeme}/order/${orderId}/confirmed`, { pauza: 9000 });
  const blok = await n.ev(`(() => { const el = document.querySelector('[data-testid="order-documents"]'); if (!el) return null; el.scrollIntoView({ block: 'center' }); return el.innerText; })()`);
  console.log('stránka — blok dokumentů:', blok ? '\n  ' + blok.split('\n').filter(Boolean).join('\n  ') : '(není)');
  await new Promise((r) => setTimeout(r, 800));
  const r = await p.S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
  console.log('snímek:', out);
} finally {
  await p.zavrit();
}
