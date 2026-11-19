/**
 * Sandbox: Česká pošta – na adresu zahraničí. Uloží nastavení jako admin,
 * pak spočítá dopravu pro košík do SK — výrobky s hmotností (součet) a bez
 * (průměr z nastavení). Hmotnosti výrobků na konci vrátí.
 */
import { api, CIL, jenSandbox } from './lib/api.mjs';

jenSandbox();
const T1 = 'Keramická kytka bílá, kopretina, žlutý střed';
const T2 = 'Keramická kytka bílá, modrý střed';
const F = 'id,title,weight,variants.id';
const najdi = async (t) => (await api(`/admin/products?q=${encodeURIComponent(t)}&fields=${F}`)).products.find((x) => x.title === t);
const p1 = await najdi(T1), p2 = await najdi(T2);
const zaloha = [p1, p2].map((p) => ({ id: p.id, weight: p.weight ?? null }));

const { api_keys } = await api('/admin/api-keys?type=publishable&fields=token,revoked_at&limit=10');
const pk = api_keys.find((k) => !k.revoked_at).token;
const st = (p, body) => fetch(CIL + p, { method: body ? 'POST' : 'GET', headers: { 'x-publishable-api-key': pk, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ s: r.status, j: await r.json().catch(() => ({})) }));

try {
  const stav = await api('/admin/international-shipping', {
    countries: ['sk'], service: 'Standardní balík do zahraničí - prioritní', parcel_weight_kg: 3, packaging_kg: 0, overrides_czk: {},
  });
  const sk = stav.countries.find((c) => c.country_code === 'sk');
  console.log('uloženo: volba', Boolean(stav.option_id), '| kurz', stav.rates_date, '| SK pro 3 kg:', sk?.quote?.price_czk, 'Kč =', sk?.quote?.amount, sk?.quote?.currency_code);
  console.log('kalkulačka DE 5 kg:', (await api('/admin/international-shipping?zeme=de&kg=5')).quotes.map((q) => `${q.service.replace(' do zahraničí', '')}: ${q.price_czk ?? '—'}`).join(' | '));

  const kosik = async (popis) => {
    const { j: { regions } } = await st('/store/regions');
    const region = regions.find((r) => r.countries.some((c) => c.iso_2 === 'sk'));
    const { j: { cart } } = await st('/store/carts', { region_id: region.id });
    await st(`/store/carts/${cart.id}/line-items`, { variant_id: p1.variants[0].id, quantity: 2 });
    await st(`/store/carts/${cart.id}/line-items`, { variant_id: p2.variants[0].id, quantity: 1 });
    await st(`/store/carts/${cart.id}`, { email: 'test@sandbox.test', shipping_address: { country_code: 'sk', first_name: 'Test', last_name: 'Zahraničí', address_1: 'Hlavná 1', city: 'Bratislava', postal_code: '81101' } });
    await st(`/store/carts/${cart.id}`); // srovnání košíku = razítka hmotnosti
    const { j } = await st(`/store/shipping-options?cart_id=${cart.id}`);
    const opt = (j.shipping_options ?? []).find((o) => o.data?.international === true);
    const calc = opt ? await st(`/store/shipping-options/${opt.id}/calculate`, { cart_id: cart.id, data: {} }) : null;
    const { j: { cart: c2 } } = await st(`/store/carts/${cart.id}?fields=items.metadata,items.quantity,items.product_title`);
    const vahy = (c2.items ?? []).filter((i) => i.metadata?.ship_class).map((i) => `${i.quantity}×${i.metadata?.ship_weight_g ?? '?'}g`).join(', ');
    console.log(`${popis}: volby [${(j.shipping_options ?? []).map((o) => o.name).join(' | ')}] | razítka ${vahy} | cena ${calc?.j?.shipping_option?.calculated_price?.calculated_amount ?? JSON.stringify(calc?.j).slice(0, 160)} ${cart.currency_code}`);
  };

  await api(`/admin/products/${p1.id}`, { weight: 450 });
  await api(`/admin/products/${p2.id}`, { weight: null });
  await kosik('jeden bez hmotnosti → průměr 3 kg (SK prioritní do 3 kg)');
  await api(`/admin/products/${p2.id}`, { weight: 800 });
  await kosik('všechny s hmotností → 2×450 + 800 = 1,7 kg (do 2 kg)');
  await api(`/admin/products/${p1.id}`, { weight: 9000 });
  await kosik('těžké → 2×9 + 0,8 = 18,8 kg (do 19 kg)');
} finally {
  for (const z of zaloha) await api(`/admin/products/${z.id}`, { weight: z.weight });
  console.log('hmotnosti vráceny');
}
