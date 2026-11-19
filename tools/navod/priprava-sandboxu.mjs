/**
 * Naplní SANDBOX skutečně vypadajícími výrobky, ať GIFy návodu ukazují
 * obchod, jak ho Lucie zná (19. 11. 2026). Bere veřejný katalog z obchodu
 * (jen čtení Store API — názvy, popisy, fotky, ceny, kolekce, kategorie)
 * a zakládá kopie v sandboxu přes admin API. Do produkce nic nezapisuje.
 *
 *   ZDROJ_PK=<veřejný publishable klíč obchodu> node tools/navod/priprava-sandboxu.mjs
 *
 * Idempotentní: výrobek se stejným handle přeskočí.
 */
const ZDROJ = process.env.ZDROJ ?? 'https://admin.keramickazahrada.cz';
const ZDROJ_PK = process.env.ZDROJ_PK;
const CIL = process.env.CIL ?? 'http://localhost:9100';
if (!ZDROJ_PK) throw new Error('Chybí ZDROJ_PK (veřejný klíč obchodu).');
if (!/localhost|127\.0\.0\.1/.test(CIL)) throw new Error('Cíl musí být sandbox (localhost).');

const NA_KOLEKCI = Number(process.env.NA_KOLEKCI ?? 4);

const src = async (p) => {
  const r = await fetch(ZDROJ + p, { headers: { 'x-publishable-api-key': ZDROJ_PK } });
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json();
};
const { token } = await (await fetch(CIL + '/auth/user/emailpass', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'admin@sandbox.test', password: 'sandbox-admin-123' }),
})).json();
const H = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
const api = async (p, body, method) => {
  const r = await fetch(CIL + p, { method: method ?? (body ? 'POST' : 'GET'), headers: H, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method ?? (body ? 'POST' : 'GET')} ${p} ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
};

// ——— zdroj
const { regions } = await src('/store/regions?fields=id,currency_code');
const czk = regions.find((r) => r.currency_code === 'czk');
const { collections: zdrojKolekce } = await src('/store/collections?limit=50&fields=id,title,handle,metadata');
const { product_categories: zdrojKategorie } = await src('/store/product-categories?limit=100&fields=id,name,handle,metadata,rank');
const vsechny = [];
for (let off = 0; ; off += 100) {
  const j = await src(`/store/products?limit=100&offset=${off}&region_id=${czk.id}&fields=id,title,handle,subtitle,description,thumbnail,*images,*categories,collection_id,+metadata,*variants,*variants.calculated_price,+variants.inventory_quantity,+variants.allow_backorder,weight`);
  vsechny.push(...j.products);
  if (vsechny.length >= j.count || !j.products.length) break;
}

// ——— cíl: kolekce a kategorie
const { collections: cilKolekce } = await api('/admin/collections?limit=100&fields=id,title,handle');
const kolekceId = new Map();
for (const k of zdrojKolekce) {
  let c = cilKolekce.find((x) => x.handle === k.handle);
  if (!c) c = (await api('/admin/collections', { title: k.title, handle: k.handle, metadata: k.metadata ?? {} })).collection;
  kolekceId.set(k.id, c.id);
}
const { product_categories: cilKategorie } = await api('/admin/product-categories?limit=200&fields=id,name,handle,metadata');
const kategorieId = new Map();
for (const k of zdrojKategorie) {
  let c = cilKategorie.find((x) => x.handle === k.handle);
  const metadata = { ...(k.metadata ?? {}), collection_id: kolekceId.get(k.metadata?.collection_id) ?? undefined };
  if (!c) c = (await api('/admin/product-categories', { name: k.name, handle: k.handle, is_active: true, is_internal: false, metadata })).product_category;
  else await api(`/admin/product-categories/${c.id}`, { metadata: { ...(c.metadata ?? {}), ...metadata } });
  kategorieId.set(k.id, c.id);
}

// ——— výběr výrobků: z každé kolekce pár s fotkou, se skladem i bez
const vybrane = [];
for (const k of zdrojKolekce) {
  const z = vsechny.filter((p) => p.thumbnail && !p.metadata?.gift_voucher && (p.collection_id === k.id || (p.categories ?? []).some((c) => zdrojKategorie.find((x) => x.id === c.id)?.metadata?.collection_id === k.id)));
  for (const p of z.slice(0, NA_KOLEKCI)) if (!vybrane.includes(p)) vybrane.push(p);
}

const { products: [vzor] } = await api('/admin/products?limit=1&fields=id,shipping_profile.id,sales_channels.id&handle=sandbox-miska-zahrada').catch(() => ({ products: [] }));
const ref = vzor ?? (await api('/admin/products?limit=1&fields=id,shipping_profile.id,sales_channels.id')).products[0];
const { stock_locations } = await api('/admin/stock-locations?fields=id,name');
const lokace = stock_locations[0].id;

let zalozeno = 0;
for (const p of vybrane) {
  const { products: uz } = await api(`/admin/products?handle=${encodeURIComponent(p.handle)}&fields=id`);
  if (uz.length) continue;
  const v = p.variants?.[0];
  const cena = v?.calculated_price?.original_amount ?? v?.calculated_price?.calculated_amount ?? 990;
  const skladem = Math.max(0, Number(v?.inventory_quantity ?? 0));
  const meta = Object.fromEntries(Object.entries(p.metadata ?? {}).filter(([k]) => ['shipping_class', 'packaging_price', 'fragile', 'cod_allowed', 'frost_resistant', 'material', 'dimensions', 'clearance', 'clearance_note'].includes(k)));
  const { product } = await api('/admin/products', {
    title: p.title,
    handle: p.handle,
    subtitle: p.subtitle ?? undefined,
    description: p.description ?? undefined,
    status: 'published',
    thumbnail: p.thumbnail,
    images: (p.images ?? []).slice(0, 4).map((i) => ({ url: i.url })),
    collection_id: kolekceId.get(p.collection_id) ?? undefined,
    categories: (p.categories ?? []).map((c) => kategorieId.get(c.id)).filter(Boolean).map((id) => ({ id })),
    weight: p.weight ?? undefined,
    metadata: meta,
    shipping_profile_id: ref.shipping_profile?.id,
    sales_channels: ref.sales_channels.map((c) => ({ id: c.id })),
    options: [{ title: 'Provedení', values: ['Standard'] }],
    variants: [{
      title: 'Standard', manage_inventory: true, allow_backorder: Boolean(v?.allow_backorder),
      options: { Provedení: 'Standard' },
      prices: [{ currency_code: 'czk', amount: cena }, { currency_code: 'eur', amount: Math.ceil(cena / 25) }],
    }],
  });
  const { product: s } = await api(`/admin/products/${product.id}?fields=variants.inventory_items.inventory_item_id`);
  const item = s.variants[0]?.inventory_items?.[0]?.inventory_item_id;
  if (item) {
    await api(`/admin/inventory-items/${item}/location-levels`, { location_id: lokace, stocked_quantity: skladem || (zalozeno % 3 === 0 ? 0 : 2) }).catch(() => undefined);
  }
  zalozeno++;
  console.log('+', p.title);
}
console.log(`hotovo: ${zalozeno} nových výrobků, ${kolekceId.size} kolekcí, ${kategorieId.size} kategorií`);
