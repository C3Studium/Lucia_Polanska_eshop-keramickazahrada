/**
 * Sandbox: objednávkám „Testovaci Zákazník" dá běžná jména a adresy, ať
 * GIFy návodu vypadají jako skutečný provoz.  node tools/navod/jmena.mjs <order_id>…
 */
import { api, jenSandbox } from './lib/api.mjs';
jenSandbox();
const LIDE = [
  ['Jana', 'Nováková', 'Lipová 12', 'Písek', '397 01'],
  ['Petr', 'Svoboda', 'Nádražní 5', 'Strakonice', '386 01'],
  ['Eva', 'Dvořáková', 'U Lesa 230', 'Putim', '397 01'],
  ['Martin', 'Černý', 'Husova 41', 'České Budějovice', '370 01'],
];
let i = 0;
for (const id of process.argv.slice(2)) {
  const [first_name, last_name, address_1, city, postal_code] = LIDE[i++ % LIDE.length];
  const { order } = await api(`/admin/orders/${id}?fields=id,shipping_address.*,billing_address.*`);
  const adresa = (a) => ({ ...(a ? { first_name, last_name, address_1, city, postal_code, country_code: a.country_code ?? 'cz', phone: a.phone ?? '+420777000111' } : {}) });
  await api(`/admin/orders/${id}`, {
    shipping_address: order.shipping_address ? adresa(order.shipping_address) : undefined,
    billing_address: order.billing_address ? adresa(order.billing_address) : undefined,
  }).then(() => console.log('✓', id, first_name, last_name)).catch((e) => console.log('✗', id, e.message.slice(0, 200)));
}
