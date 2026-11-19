/* Sdílené pomůcky scénářů (soubory s „_" nahraj.mjs nespouští). */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { css } from '../lib/rekorder.mjs';

const SANDBOX = path.resolve(import.meta.dirname, '../../../backend/sandbox');
const LIDE = [
  ['Jana', 'Nováková', 'Lipová 12', 'Písek', '397 01'],
  ['Petr', 'Svoboda', 'Nádražní 5', 'Strakonice', '386 01'],
  ['Eva', 'Dvořáková', 'U Lesa 230', 'Putim', '397 01'],
  ['Martin', 'Černý', 'Husova 41', 'České Budějovice', '370 01'],
];
let lidi = 0;

/**
 * Čerstvá objednávka v sandboxu (smoke-order přes Store API) se skutečně
 * vypadajícím výrobkem a jménem. Vrací { id, display_id }.
 */
export const novaObjednavka = async (api, { vyrobek, doprava = 'cz_address', platba = 'comgate', produkt = 'regular' } = {}) => {
  const { orders: pred } = await api('/admin/orders?limit=1&order=-created_at&fields=display_id');
  const args = ['smoke-order.mjs', `--shipping=${doprava}`, `--provider=${platba}`, `--product=${produkt}`];
  const [first_name, last_name, address_1, city, postal_code] = LIDE[lidi++ % LIDE.length];
  args.push(`--email=${first_name.toLowerCase()}.${last_name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@sandbox.test`);
  if (vyrobek) {
    const { products } = await api(`/admin/products?q=${encodeURIComponent(vyrobek)}&fields=title,variants.id`);
    const p = products.find((x) => x.title === vyrobek);
    if (!p) throw new Error('Chybí výrobek ' + vyrobek);
    args.push(`--variant=${p.variants[0].id}`);
  }
  execFileSync(process.execPath, args, { cwd: SANDBOX, stdio: 'pipe', timeout: 180000 });
  const { orders } = await api('/admin/orders?limit=1&order=-created_at&fields=id,display_id,shipping_address.*,billing_address.*');
  const o = orders[0];
  if (pred[0] && o.display_id <= pred[0].display_id) throw new Error('smoke-order objednávku nezaložil');
  const adresa = (a) => a && { first_name, last_name, address_1, city, postal_code, country_code: a.country_code ?? 'cz', phone: a.phone ?? '+420777000111' };
  await api(`/admin/orders/${o.id}`, { shipping_address: adresa(o.shipping_address) ?? undefined, billing_address: adresa(o.billing_address) ?? undefined }).catch(() => undefined);
  return { id: o.id, display_id: o.display_id, jmeno: `${first_name} ${last_name}` };
};

export const detailObjednavky = async (n, ctx, id) => {
  await ctx.admin(n);
  await n.jdi(`${ctx.ADMIN}/app/orders/${id}`, { cekej: `[...document.querySelectorAll('h2')].some(h => h.textContent.includes('Postup objednávky'))`, pauza: 3000 });
  await n.drz(800);
};

export const PITKO = 'Keramické pítko s vlnitým zeleným okrajem';
export const KYTKA = 'Keramická kytka bílá, modrý střed';
export const ZVONEK = 'Zvonkové tlačítko Souhvězdí';

export const vyrobek = async (api, title) => {
  const { products } = await api(`/admin/products?limit=10&fields=id,title&q=${encodeURIComponent(title)}`);
  const p = products.find((x) => x.title === title);
  if (!p) throw new Error('Ve sandboxu chybí výrobek ' + title);
  return p.id;
};

/** Záloha výrobku před scénářem — vše, co scénáře mění. */
export const zalohaVyrobku = async (api, title) => {
  const id = await vyrobek(api, title);
  const { product } = await api(`/admin/products/${id}?fields=id,title,status,description,subtitle,metadata,collection_id,categories.id,thumbnail,images.url,shipping_profile.id,variants.id,variants.prices.amount,variants.prices.currency_code,variants.allow_backorder,variants.inventory_items.inventory_item_id`);
  const { stock_locations } = await api('/admin/stock-locations?fields=id');
  const lok = stock_locations[0].id;
  const sklad = [];
  for (const v of product.variants) {
    const item = v.inventory_items?.[0]?.inventory_item_id;
    if (!item) continue;
    const { inventory_levels } = await api(`/admin/inventory-items/${item}/location-levels?fields=stocked_quantity,location_id`);
    const lvl = inventory_levels.find((l) => l.location_id === lok);
    sklad.push({ item, lok, mnozstvi: lvl?.stocked_quantity ?? 0 });
  }
  return { id, product, sklad };
};

export const obnovitVyrobek = async (api, z) => {
  if (!z) return;
  const p = z.product;
  /* Medusa metadata slučuje — klíč přidaný scénářem se smaže jen hodnotou "". */
  const { product: nyni } = await api(`/admin/products/${z.id}?fields=metadata`);
  const metadata = { ...(p.metadata ?? {}) };
  for (const k of Object.keys(nyni.metadata ?? {})) if (!(k in metadata)) metadata[k] = '';
  await api(`/admin/products/${z.id}`, {
    title: p.title, status: p.status, description: p.description ?? '', subtitle: p.subtitle ?? '',
    metadata, collection_id: p.collection_id, categories: p.categories.map((c) => ({ id: c.id })),
    thumbnail: p.thumbnail, images: (p.images ?? []).map((i) => ({ url: i.url })),
    shipping_profile_id: p.shipping_profile?.id,
  });
  for (const v of p.variants) {
    await api(`/admin/products/${z.id}/variants/${v.id}`, { allow_backorder: v.allow_backorder, prices: v.prices.map((x) => ({ amount: x.amount, currency_code: x.currency_code })) }).catch(() => undefined);
  }
  // přidané varianty pryč
  const { product: ted } = await api(`/admin/products/${z.id}?fields=variants.id`);
  for (const v of ted.variants) if (!p.variants.some((x) => x.id === v.id)) await api(`/admin/products/${z.id}/variants/${v.id}`, null, 'DELETE').catch(() => undefined);
  for (const s of z.sklad) await api(`/admin/inventory-items/${s.item}/location-levels/${s.lok}`, { stocked_quantity: s.mnozstvi }).catch(() => undefined);
  await api(`/admin/workbench/products/${z.id}/sale`, null, 'DELETE').catch(() => undefined);
};

/** Otevře detail výrobku a počká na stránku. */
export const detail = async (n, ctx, id) => {
  await ctx.admin(n);
  await n.jdi(`${ctx.ADMIN}/app/produkt/${id}`, { cekej: `document.getElementById('produkt-zarazeni')`, pauza: 2500 });
  await n.drz(700);
};

/** Prvek uvnitř oddílu podle id kotvy. */
export const v = (id, sel) => `document.getElementById(${JSON.stringify(id)})?.querySelector(${JSON.stringify(sel)})`;
export const oddil = (id) => css('#' + id);

/** Odešle a doručí objednávku přes admin API (jako e2e.mjs shipAndDeliver). */
export const odeslatADorucit = async (api, orderId) => {
  const fs = await import('node:fs');
  const state = JSON.parse(fs.readFileSync(path.join(SANDBOX, '.run', 'seed-state.json'), 'utf8'));
  const load = async () => (await api(`/admin/orders/${orderId}?fields=id,*items,items.requires_shipping,items.detail.fulfilled_quantity,*fulfillments,fulfillments.requires_shipping,fulfillments.shipped_at`)).order;
  const order = await load();
  const open = (ship) => order.items.filter((i) => Boolean(i.requires_shipping) === ship).map((i) => ({ id: i.id, quantity: Number(i.quantity) - Number(i.detail?.fulfilled_quantity ?? 0) })).filter((i) => i.quantity > 0);
  const service = open(false);
  if (service.length) await api(`/admin/orders/${orderId}/fulfillments`, { items: service, location_id: state.stock_location_id });
  const items = open(true);
  const before = new Set((order.fulfillments ?? []).map((f) => f.id));
  if (items.length) await api(`/admin/orders/${orderId}/fulfillments`, { items, location_id: state.stock_location_id });
  const after = await load();
  const f = (after.fulfillments ?? []).filter((x) => !before.has(x.id)).find((x) => x.requires_shipping !== false);
  await api(`/admin/orders/${orderId}/fulfillments/${f.id}/shipments`, { items, labels: [] });
  await api(`/admin/orders/${orderId}/fulfillments/${f.id}/mark-as-delivered`, {});
  return state;
};

/** Zákaznická žádost (reklamace / odstoupení) přes Store API, jako z formuláře na webu. */
export const podatZadost = async (api, { orderId, kind = 'reklamace', reason, resolution = 'refund' }) => {
  const state = await odeslatADorucit(api, orderId);
  const { order } = await api(`/admin/orders/${orderId}?fields=display_id,email`);
  const r = await fetch('http://127.0.0.1:9100/store/return-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-publishable-api-key': state.publishable_key },
    body: JSON.stringify({ order_display_id: String(order.display_id), email: order.email, kind, reason, ...(kind === 'reklamace' ? { requested_resolution: resolution } : {}) }),
  });
  if (!r.ok) throw new Error('žádost: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const { requests } = await api(`/admin/return-requests?order_id=${orderId}`).catch(() => ({ requests: [] }));
  return { requests };
};
