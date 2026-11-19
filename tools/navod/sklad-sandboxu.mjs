/**
 * Sandbox: realistické počty kusů (1–4, každý pátý vyprodaný), ať GIFy
 * nemají všechno „Vyprodáno".  node tools/navod/sklad-sandboxu.mjs
 */
import { api, jenSandbox } from './lib/api.mjs';
jenSandbox();
const { stock_locations } = await api('/admin/stock-locations?fields=id');
const lok = stock_locations[0].id;
const { products } = await api('/admin/products?limit=200&fields=id,title,variants.id,variants.manage_inventory,variants.inventory_items.inventory_item_id');
let i = 0, n = 0;
for (const p of products) {
  if (/poukaz/i.test(p.title)) continue;
  for (const v of p.variants) {
    const item = v.inventory_items?.[0]?.inventory_item_id;
    if (!item || !v.manage_inventory) continue;
    const kusu = i++ % 5 === 4 ? 0 : 1 + (i % 4);
    const { inventory_levels } = await api(`/admin/inventory-items/${item}/location-levels?fields=id,location_id`);
    if (inventory_levels.some((l) => l.location_id === lok)) await api(`/admin/inventory-items/${item}/location-levels/${lok}`, { stocked_quantity: kusu });
    else await api(`/admin/inventory-items/${item}/location-levels`, { location_id: lok, stocked_quantity: kusu });
    n++;
  }
}
console.log(`sklad nastaven u ${n} provedení`);
