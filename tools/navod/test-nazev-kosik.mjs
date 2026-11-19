/** Sandbox: přejmenuje se zahraniční doprava v košíku podle nejlevnější služby? */
import { api, CIL, jenSandbox } from './lib/api.mjs';

jenSandbox();
const { api_keys } = await api('/admin/api-keys?type=publishable&fields=token,revoked_at&limit=10');
const pk = api_keys.find((k) => !k.revoked_at).token;
const st = (p, body) => fetch(CIL + p, { method: body ? 'POST' : 'GET', headers: { 'x-publishable-api-key': pk, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ s: r.status, j: await r.json().catch(() => ({})) }));
const varianta = process.argv[2] ?? 'variant_01M7SMJCB5P6NQAG4FCVK5K40F';

const { j: { regions } } = await st('/store/regions');
const region = regions.find((r) => r.countries.some((c) => c.iso_2 === 'sk'));
const { j: { cart } } = await st('/store/carts', { region_id: region.id });
await st(`/store/carts/${cart.id}/line-items`, { variant_id: varianta, quantity: 1 });
await st(`/store/carts/${cart.id}`, { email: 'test@sandbox.test', shipping_address: { country_code: 'sk', first_name: 'Test', last_name: 'Zahraničí', address_1: 'Primaciálne námestie 1', city: 'Bratislava', postal_code: '81499' } });
const { j } = await st(`/store/shipping-options?cart_id=${cart.id}`);
const opt = (j.shipping_options ?? []).find((o) => o.data?.international === true);
const add = await st(`/store/carts/${cart.id}/shipping-methods`, { option_id: opt.id, data: {} });
console.log('po přidání dopravy:', add.s, add.j?.cart?.shipping_methods?.map((m) => `${m.name} ${m.amount}`).join(' / ') ?? JSON.stringify(add.j).slice(0, 200));
const cteni = await st(`/store/carts/${cart.id}?fields=*shipping_methods`);
console.log('po načtení košíku:', cteni.j?.cart?.shipping_methods?.map((m) => `${m.name} ${m.amount}`).join(' / '));
const cteni2 = await st(`/store/carts/${cart.id}?fields=*shipping_methods`);
console.log('po druhém načtení:', cteni2.j?.cart?.shipping_methods?.map((m) => `${m.name} ${m.amount}`).join(' / '));
