/* Sdílené pomůcky scénářů (soubory s „_" nahraj.mjs nespouští). */
import { css } from '../lib/rekorder.mjs';

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
