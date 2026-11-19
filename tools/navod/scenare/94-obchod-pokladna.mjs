import { tl } from '../lib/rekorder.mjs';
import { obchod, stav, store } from './_obchod.mjs';

/* Obchod — košík a pokladna (doprava, platba, zadání zakázky, poukaz).
   Košík se založí přes Store API a prohlížeč ho dostane cookie
   `_medusa_cart_id` — stejně jako po kliknutí „Do košíku". */
const ADRESA = { first_name: 'Jana', last_name: 'Nováková', address_1: 'Lipová 12', city: 'Písek', postal_code: '39701', country_code: 'cz', phone: '+420777123456' };

const kosik = async ({ variant, metadata = {}, adresa = true, doprava = null } = {}) => {
  const s = stav();
  const { cart } = await store('/store/carts', { region_id: s.regions.cz });
  await store(`/store/carts/${cart.id}/line-items-custom`, { variant_id: variant, quantity: 1, metadata });
  if (adresa) await store(`/store/carts/${cart.id}`, { email: 'jana.novakova@sandbox.test', shipping_address: ADRESA, billing_address: ADRESA });
  if (doprava) {
    const { shipping_options } = await store(`/store/shipping-options?cart_id=${cart.id}`);
    const volba = shipping_options.find((o) => doprava.test(o.name));
    if (volba) await store(`/store/carts/${cart.id}/shipping-methods`, { option_id: volba.id });
  }
  return cart.id;
};
const varianta = async (api, title) => {
  const { products } = await api(`/admin/products?q=${encodeURIComponent(title)}&fields=title,variants.id`);
  return products.find((p) => p.title === title).variants[0].id;
};
const sKosikem = async (n, ctx, cartId, cesta) => {
  await n.S('Network.setCookie', { name: '_medusa_cart_id', value: cartId, domain: 'localhost', path: '/' });
  await obchod(n, ctx, cesta, { cekej: `document.querySelector('main')` });
  await n.pockej(2500);
};
const volbaS = (text) => `[...document.querySelectorAll('main label, main button, main [role=radio]')].find(e => e.textContent.includes(${JSON.stringify(text)}) && e.getClientRects().length)`;

export default [
  {
    klic: 'obchod.doprava',
    oblast: 'store',
    celeOkno: true,
    pred: async ({ api }) => kosik({ variant: await varianta(api, 'Keramické kytičky - různé barvy') }),
    async hrat(n, ctx, cartId) {
      await sKosikem(n, ctx, cartId, '/cz/checkout?step=delivery');
      await n.popisek('Pokladna → „Doručení": vyberte, jak k vám kousek dorazí');
      await n.drz(1800);
      for (const [text, popisek] of [['adresu', 'Česká pošta až domů'], ['Balíkovn', 'Balíkovna — výdejnu vyberete na mapě'], ['Osobní', 'Osobní odběr v ateliéru v Putimi']]) {
        if (await n.ev(`!!(${volbaS(text)})`)) await n.klik(volbaS(text), { popisek, po: 1600 });
      }
      await n.popisek('Cena dopravy se ukáže hned u volby');
      await n.drz(1800);
    },
  },
  {
    klic: 'obchod.platba',
    oblast: 'store',
    celeOkno: true,
    pred: async ({ api }) => kosik({ variant: await varianta(api, 'Keramické kytičky - různé barvy'), doprava: /adresu/i }),
    async hrat(n, ctx, cartId) {
      await sKosikem(n, ctx, cartId, '/cz/checkout?step=payment');
      await n.popisek('Pokladna → „Platba"');
      await n.drz(1800);
      for (const [text, popisek] of [['Kartou', 'Kartou nebo bankou online (zabezpečená brána ComGate)'], ['Apple', 'Apple Pay / Google Pay'], ['Dobírk', 'Dobírka — zaplatíte při převzetí']]) {
        if (await n.ev(`!!(${volbaS(text)})`)) await n.klik(volbaS(text), { popisek, po: 1500 });
      }
      await n.popisek('Pokračujte na Přehled a „Zaplatit" — údaje karty k nám nechodí');
      await n.drz(2000);
    },
  },
  {
    klic: 'obchod.zakazka',
    oblast: 'store',
    celeOkno: true,
    pred: async () => kosik({ variant: stav().products.made_to_order.variant_id, metadata: { made_to_order: { specification: '' } } }),
    async hrat(n, ctx, cartId) {
      await sKosikem(n, ctx, cartId, '/cz/checkout?step=brief');
      await n.popisek('U zakázky je v pokladně krok „Zadání" — bez něj nejde pokračovat');
      await n.drz(2000);
      const pole = `[...document.querySelectorAll('main textarea')].find(t => t.getClientRects().length)`;
      if (await n.ev(`!!(${pole})`)) await n.psat(pole, 'Květináč 30 cm, zelená glazura, na okraji lístky. Na terasu.', { popisek: 'Napište, co přesně chcete (barvy, rozměry, místo)' });
      const foto = `[...document.querySelectorAll('main button, main label')].find(b => /fotk/i.test(b.textContent) && b.getClientRects().length)`;
      if (await n.ev(`!!(${foto})`)) { await n.mys(foto); await n.popisek('Fotky místa nebo inspirace pomůžou'); await n.drz(1600); }
      await n.popisek('Pak doprava a platba zálohy — zadání vám potvrdím e-mailem');
      await n.drz(2000);
    },
  },
  {
    klic: 'obchod.poukaz',
    oblast: 'store',
    celeOkno: true,
    pred: async () => kosik({ variant: stav().products.voucher_custom.variant_id, adresa: false }),
    async hrat(n, ctx, cartId) {
      await sKosikem(n, ctx, cartId, '/cz/cart');
      const blok = `[...document.querySelectorAll('main *')].find(e => /poukaz/i.test(e.textContent) && /hodnot/i.test(e.textContent) && e.children.length > 1 && e.getClientRects().length && e.textContent.length < 1500)`;
      if (await n.ev(`!!(${blok})`)) await n.mys(blok);
      await n.popisek('Poukaz se nastavuje v košíku pod souhrnem');
      await n.drz(1800);
      const castka = `[...document.querySelectorAll('main button')].find(b => /1\\s?000/.test(b.textContent) && b.getClientRects().length)`;
      if (await n.ev(`!!(${castka})`)) await n.klik(castka, { popisek: 'Hodnota poukazu', po: 1200 });
      for (const [text, popisek] of [['Elektronick', 'Elektronický přijde e-mailem, vytištěný pošleme poštou']]) {
        if (await n.ev(`!!(${volbaS(text)})`)) await n.klik(volbaS(text), { popisek, po: 1300 });
      }
      const jmeno = `[...document.querySelectorAll('main input[type=text], main input:not([type])')].find(i => i.getClientRects().length && /obdarovan|jméno/i.test((i.placeholder ?? '') + (i.closest('label')?.textContent ?? '')))`;
      if (await n.ev(`!!(${jmeno})`)) await n.psat(jmeno, 'Babička Věra', { popisek: 'Komu je poukaz (nepovinné)' });
      await n.klik(tl('Uložit poukaz'), { popisek: '„Uložit poukaz" — pak „Pokračovat do pokladny"', po: 2200 });
    },
  },
];
