/**
 * Sandbox: název dopravy do zahraničí v objednávce, e-mailu a PDF potvrzení.
 *   node tools/navod/over-nazev-dopravy.mjs <order_id>
 * Vypíše cestu k PDF (PDF_CESTA=…) pro kontrolu obsahu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { api, jenSandbox } from './lib/api.mjs';

jenSandbox();
const orderId = process.argv[2];
const { order } = await api(`/admin/orders/${orderId}?fields=id,display_id,currency_code,shipping_methods.name,shipping_methods.amount`);
console.log(`objednávka #${order.display_id}: doprava „${order.shipping_methods.map((m) => m.name).join(' / ')}" ${order.shipping_methods[0]?.amount} ${order.currency_code}`);

/* e-mail potvrzení objednávky ze zachytávače (HTML soubor vedle JSON) */
const MAIL = path.resolve(import.meta.dirname, '../../backend/sandbox/.mail');
const jsony = fs.readdirSync(MAIL).filter((f) => f.endsWith('.json')).sort().reverse();
for (const jmeno of jsony.slice(0, 40)) {
  const zaznam = JSON.parse(fs.readFileSync(path.join(MAIL, jmeno), 'utf8'));
  if (!zaznam.files?.html) continue;
  const html = fs.readFileSync(path.join(MAIL, zaznam.files.html), 'utf8');
  if (!html.includes(`${order.display_id}`) || !/Česká pošta/.test(html)) continue;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');
  const m = text.match(/Česká pošta[^€]{0,80}/);
  console.log(`e-mail „${zaznam.subject}":`, m ? `„${m[0].trim()}"` : '(název nenalezen)');
}

const STATIC = path.resolve(import.meta.dirname, '../../backend/static');
const pdf = fs.readdirSync(STATIC).find((f) => f.includes(order.id) && f.endsWith('.pdf'));
console.log('PDF_CESTA=' + (pdf ? path.join(STATIC, pdf) : '(nenalezeno)'));
