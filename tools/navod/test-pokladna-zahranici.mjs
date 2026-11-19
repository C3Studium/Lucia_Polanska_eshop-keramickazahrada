/**
 * Sandbox: krok Doprava v pokladně pro slovenský košík — u zahraniční
 * dopravy má být vidět název vybrané (nejlevnější) služby ČP.
 */
import fs from 'node:fs';
import { Nahravka, otevritProhlizec } from './lib/rekorder.mjs';
import { api, CIL, jenSandbox } from './lib/api.mjs';

jenSandbox();
const OBCHOD = process.env.OBCHOD ?? 'http://localhost:8100';
const out = 'C:/Users/ADMIN/AppData/Local/Temp/claude/8d6486bb6074ccad/b59cccbc-f5fd-462a-9d3e-ba030c6c2c96/scratchpad/pokladna-zahranici.png';
const { api_keys } = await api('/admin/api-keys?type=publishable&fields=token,revoked_at&limit=10');
const pk = api_keys.find((k) => !k.revoked_at).token;
const st = (p, body) => fetch(CIL + p, { method: body ? 'POST' : 'GET', headers: { 'x-publishable-api-key': pk, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

const { regions } = await st('/store/regions');
const region = regions.find((r) => r.countries.some((c) => c.iso_2 === 'sk'));
const { cart } = await st('/store/carts', { region_id: region.id });
await st(`/store/carts/${cart.id}/line-items`, { variant_id: 'variant_01M7SMJCB5P6NQAG4FCVK5K40F', quantity: 1 });
const adresa = { country_code: 'sk', first_name: 'Test', last_name: 'Zahraničí', address_1: 'Primaciálne námestie 1', city: 'Bratislava', postal_code: '81499', phone: '+421900000000' };
await st(`/store/carts/${cart.id}`, { email: 'test@sandbox.test', shipping_address: adresa, billing_address: adresa });
const { shipping_options } = await st(`/store/shipping-options?cart_id=${cart.id}`);
const opt = shipping_options.find((o) => o.data?.international === true);
await st(`/store/carts/${cart.id}/shipping-methods`, { option_id: opt.id, data: {} });

const p = await otevritProhlizec({ izolovane: true, width: 1280, height: 900 });
const n = new Nahravka(p, { celeOkno: true });
try {
  await n.jdi(`${OBCHOD}/sk`, { pauza: 4000 });
  await p.S('Network.setCookie', { name: '_medusa_cart_id', value: cart.id, url: OBCHOD });
  await n.jdi(`${OBCHOD}/sk/checkout?step=delivery`, { pauza: 9000 });
  const text = await n.ev(`document.body.innerText`);
  const radky = String(text).split('\n').filter((r) => /Česká pošta|zahrani|nejlevnější/i.test(r)).slice(0, 8);
  console.log('pokladna — řádky s dopravou:\n  ' + radky.join('\n  '));
  const r = await p.S('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
  console.log('snímek:', out);
} finally {
  await p.zavrit();
}
