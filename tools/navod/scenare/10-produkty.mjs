import { aria, dialog, obs, tl, txt } from '../lib/rekorder.mjs';
import { KYTKA, ZVONEK, obnovitVyrobek, zalohaVyrobku } from './_spolecne.mjs';

/* Produkty — seznam (Produkty+), nový výrobek, hromadné změny. */
const SEZNAM = (ctx) => `${ctx.ADMIN}/app/produkty-workbench`;
const naSeznam = async (n, ctx, hledat = '') => {
  await ctx.admin(n);
  await n.jdi(SEZNAM(ctx) + (hledat ? `?hledat=${encodeURIComponent(hledat)}` : ''), { cekej: `document.querySelector('[aria-label^="Vybrat "]')`, pauza: 2500 });
  await n.drz(800);
};
const NOVY = 'Keramická miska Podzim';

export default [
  {
    klic: 'produkty.novy',
    oblast: 'admin',
    celeOkno: true,
    po: async ({ api }) => {
      const { products } = await api(`/admin/products?q=${encodeURIComponent(NOVY)}&fields=id,title`);
      for (const p of products.filter((x) => x.title === NOVY)) await api(`/admin/products/${p.id}`, null, 'DELETE');
    },
    async hrat(n, ctx) {
      await naSeznam(n, ctx);
      await n.klik(tl('Přidat produkt'), { popisek: 'Produkty → „Přidat produkt"', cekej: `location.pathname.includes('novy-produkt')`, po: 1200 });
      await n.klik(`[...document.querySelectorAll('main button')].find(b => b.querySelector('h2')?.textContent.trim() === 'Produkt')`, { popisek: 'Vyberte druh — běžný „Produkt", zakázka, poškozený kus, balíček', cekej: `document.getElementById('new-product-name')`, po: 900 });
      await n.psat(`document.getElementById('new-product-name')`, NOVY, { popisek: 'Napište název' });
      await n.psat(`document.getElementById('new-product-price')`, '590', { popisek: 'Cena v Kč' });
      await n.ulozMezistav?.();
      await n.klik(tl('Kolekce'), { popisek: 'Vyberte kolekci…', po: 700 }).catch(() => undefined);
      await n.klik(`[...document.querySelectorAll('[role=option], button')].find(o => o.textContent.trim().startsWith('Do bytu'))`, { po: 800 });
      await n.klik(`[...document.querySelectorAll('[role=option], button, label')].find(o => o.textContent.trim().startsWith('Štrůdláky a talíře'))`, { popisek: '…a kategorii', po: 900 });
      await n.klik(tl('Založit a otevřít'), { popisek: 'Klikněte na „Založit a otevřít"', cekej: `document.querySelector('[role=status]')?.textContent.includes('Skryto')`, po: 2200 });
      await n.popisek('Výrobek je založený jako SKRYTÝ — doplňte fotky a popis, pak „Zveřejnit v obchodě"');
      await n.mys(obs('Skryto — zákazníci tento výrobek'));
      await n.drz(2600);
    },
  },
  {
    klic: 'produkty.hledat',
    oblast: 'admin',
    async hrat(n, ctx) {
      await naSeznam(n, ctx);
      await n.klik(aria('Filtr Kolekce'), { popisek: 'Filtr: klikněte na „Kolekce"…', po: 800 });
      await n.klik(`[...document.querySelectorAll('[data-radix-popper-content-wrapper] *')].filter(e => e.textContent.trim().startsWith('Květiny') && e.getClientRects().length).pop()?.closest('[role],button,label') ?? [...document.querySelectorAll('[data-radix-popper-content-wrapper] *')].filter(e => e.textContent.trim().startsWith('Květiny')).pop()`, { popisek: '…a vyberte, co chcete vidět', po: 1500 });
      await n.klavesa('Escape', { po: 1500 });
      await n.psat(aria('Hledat produkt podle názvu'), 'bílá', { popisek: 'Hledání: napište část názvu' });
      await n.drz(2000);
      await n.popisek('Filtr si stránka pamatuje i po návratu z detailu');
      await n.drz(1500);
    },
  },
  {
    klic: 'produkty.doprava-radek',
    oblast: 'admin',
    pred: ({ api }) => zalohaVyrobku(api, KYTKA),
    po: ({ api }, z) => obnovitVyrobek(api, z),
    async hrat(n, ctx) {
      await naSeznam(n, ctx, 'kytka bílá, modrý');
      await n.klik(aria(`Upravit balné a dopravu — ${KYTKA}`), { popisek: 'Ve sloupci Doprava klikněte na štítky', po: 1000 });
      await n.drz(1500);
      const okno = `document.querySelector('[data-radix-popper-content-wrapper]')`;
      await n.psat(`${okno}.querySelector('input')`, '15', { popisek: 'Balné za kus v Kč' });
      await n.klik(tl('Velké', okno), { popisek: 'Velikost zásilky', po: 800 });
      await n.klavesa('Escape', { po: 800 });
      await n.klik(tl('Potvrdit'), { popisek: 'Pod řádkem klikněte na „Potvrdit"', po: 1600 });
      await n.popisek('Uloženo — štítky v řádku ukazují nové nastavení');
      await n.drz(1200);
    },
  },
  {
    klic: 'produkty.hromadne',
    oblast: 'admin',
    pred: async ({ api }) => [await zalohaVyrobku(api, KYTKA), await zalohaVyrobku(api, 'Keramická kytka bílá, kopretina, žlutý střed')],
    po: async ({ api }, z) => { for (const x of z ?? []) await obnovitVyrobek(api, x); },
    async hrat(n, ctx) {
      await naSeznam(n, ctx, 'kytka bílá');
      await n.klik(aria(`Vybrat ${KYTKA}`), { popisek: 'Zaškrtněte výrobky (aspoň dva)', po: 400 });
      await n.klik(aria('Vybrat Keramická kytka bílá, kopretina'), { po: 900 });
      await n.klik(tl('Hromadné změny'), { popisek: 'Dole klikněte na „Hromadné změny"', cekej: dialog, po: 1200 });
      await n.klik(`[...${dialog}.querySelectorAll('[role=group][aria-label="Křehké"] button, [aria-label="Křehké"] button')].find(b => b.textContent.trim() === 'Ano')`, { popisek: 'Změňte, co mají mít všechny stejné — třeba Křehké: Ano', po: 900 });
      await n.mys(tl('Uložit vše', dialog));
      await n.popisek('Nic se neuloží, dokud nekliknete na „Uložit vše"');
      await n.drz(1500);
      await n.klik(tl('Uložit vše', dialog), { po: 2000 });
    },
  },
  {
    klic: 'produkty.hromadne-ceny',
    oblast: 'admin',
    pred: async ({ api }) => [await zalohaVyrobku(api, KYTKA), await zalohaVyrobku(api, 'Keramická kytka bílá, kopretina, žlutý střed')],
    po: async ({ api }, z) => { for (const x of z ?? []) await obnovitVyrobek(api, x); },
    async hrat(n, ctx) {
      await naSeznam(n, ctx, 'kytka bílá');
      await n.klik(aria(`Vybrat ${KYTKA}`), { popisek: 'Zaškrtněte výrobky — „…" v řádcích zmizí', po: 400 });
      await n.klik(aria('Vybrat Keramická kytka bílá, kopretina'), { po: 900 });
      await n.klik(tl('Hromadné změny'), { popisek: 'Dole „Hromadné změny"', cekej: dialog, po: 1500 });
      await n.psat(aria(`Cena — ${KYTKA}`, dialog), '79', { popisek: 'Ceny: přepište cenu v Kč' });
      await n.psat(aria('Cena — Keramická kytka bílá, kopretina', dialog), '82', { vymazat: true });
      await n.klik(`[...${dialog}.querySelectorAll('[aria-label="Objednání bez kusů na skladu"] button')].find(b => b.textContent.trim() === 'Ano')`, { popisek: 'Objednání bez kusů na skladu: Ano…', po: 900 });
      await n.psat(`${dialog}.querySelector('[aria-label="Zpráva pro zákazníka"]')`, 'Vyrobíme do 3 týdnů.', { popisek: '…a zpráva pro zákazníka' });
      await n.mys(tl('Uložit vše', dialog));
      await n.popisek('„Uložit vše (4)" — počet změn; „Zrušit vše" nic nezmění');
      await n.drz(1500);
      await n.klik(tl('Uložit vše', dialog), { po: 2200 });
    },
  },
  {
    klic: 'produkty.nastaveni',
    oblast: 'admin',
    pred: ({ api }) => zalohaVyrobku(api, KYTKA),
    po: ({ api }, z) => obnovitVyrobek(api, z),
    async hrat(n, ctx) {
      const MENU = `document.querySelector('[role=menu]')`;
      await naSeznam(n, ctx, 'kytka bílá, modrý');
      await n.klik(aria(`Možnosti produktu ${KYTKA}`), { popisek: 'Na konci řádku klikněte na „…"', cekej: MENU, po: 1400 });
      await n.psat(aria('Balné v Kč', MENU), '15', { popisek: 'Změňte, co potřebujete — třeba Balné…' });
      await n.klik(aria('Křehké', MENU), { popisek: '…a Křehké', po: 900 });
      await n.mys(tl('Uložit vše', MENU));
      await n.popisek('Nic se zatím neuložilo — tlačítko ukazuje počet změn');
      await n.drz(1600);
      await n.klik(tl('Uložit vše', MENU), { popisek: 'Klikněte na „Uložit vše"', po: 1800 });
      await n.popisek('Uloženo. „Zrušit vše" by změny zahodilo.');
      await n.drz(1200);
    },
  },
  {
    klic: 'produkty.nastaveni-okno',
    oblast: 'admin',
    async hrat(n, ctx) {
      const MENU = `document.querySelector('[role=menu]')`;
      await naSeznam(n, ctx, 'kytka bílá, modrý');
      await n.klik(aria(`Možnosti produktu ${KYTKA}`), { popisek: 'Klikněte na „…"', cekej: MENU, po: 1400 });
      await n.klik(tl('Ceny a provedení', MENU), { popisek: '„Ceny a provedení" se otevře vlevo vedle nabídky', po: 2200 });
      await n.drz(1800);
      await n.klik(tl('Ceny a provedení', MENU), { popisek: 'Druhý klik okno zavře, nabídka zůstane', po: 1500 });
      await n.drz(800);
    },
  },
  {
    klic: 'produkty.skryt',
    oblast: 'admin',
    pred: ({ api }) => zalohaVyrobku(api, ZVONEK),
    po: ({ api }, z) => obnovitVyrobek(api, z),
    async hrat(n, ctx) {
      await naSeznam(n, ctx, 'Souhvězdí');
      await n.klik(aria(`Možnosti produktu ${ZVONEK}`), { popisek: 'U řádku klikněte na „…" — otevře se nastavení výrobku', po: 1400 });
      await n.klik(tl('Skrýt z obchodu'), { popisek: 'Nahoře „Skrýt z obchodu" — zákazníci ho neuvidí', po: 1800 });
      await n.popisek('Nabídka zůstane otevřená, tlačítko se změní na „Zobrazit v obchodě"');
      await n.drz(1600);
      await n.klik(tl('Zobrazit v obchodě'), { popisek: 'Zpátky jedním klikem', po: 1800 });
    },
  },
];
