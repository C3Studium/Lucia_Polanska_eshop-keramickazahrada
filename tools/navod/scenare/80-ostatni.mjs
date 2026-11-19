import { aria, css, obs, tl } from '../lib/rekorder.mjs';

/* Kolekce a kategorie (zakládání), zákazníci, statistiky, newsletter,
   e-maily, nastavení obchodu, právní údaje. */
const NOVA_KOLEKCE = 'Vánoce';
const NOVA_KATEGORIE = 'Vánoční ozdoby';
const otevrit = async (n, ctx, cesta, text) => {
  await ctx.admin(n);
  await n.jdi(`${ctx.ADMIN}/app/${cesta}`, { cekej: `document.body.textContent.includes(${JSON.stringify(text)})`, pauza: 2500 });
  await n.drz(900);
};
const prepinacVRadku = (text) => `(() => { const r = [...document.querySelectorAll('div')].filter(d => d.textContent.trim().startsWith(${JSON.stringify(text)}) && d.querySelector('button[role=switch]')).pop(); return r?.querySelector('button[role=switch]'); })()`;

export default [
  {
    klic: 'kategorie.nova',
    oblast: 'admin',
    po: async ({ api }) => {
      const { product_categories } = await api(`/admin/product-categories?q=${encodeURIComponent(NOVA_KATEGORIE)}&fields=id,name`);
      for (const c of product_categories.filter((x) => x.name === NOVA_KATEGORIE)) await api(`/admin/product-categories/${c.id}`, null, 'DELETE').catch(() => undefined);
      const { collections } = await api(`/admin/collections?limit=100&fields=id,title`);
      for (const c of collections.filter((x) => x.title === NOVA_KOLEKCE)) await api(`/admin/collections/${c.id}`, null, 'DELETE').catch(() => undefined);
    },
    async hrat(n, ctx) {
      await otevrit(n, ctx, 'rozdeleni', 'Kolekce a kategorie');
      await n.psat(css('input[placeholder="Nová kolekce…"]'), NOVA_KOLEKCE, { popisek: 'Nová kolekce: napište název vlevo dole…' });
      await n.klik(`document.querySelector('input[placeholder="Nová kolekce…"]').closest('.flex').querySelector('button')`, { popisek: '…a klikněte na +', po: 1600 });
      await n.psat(css('input[placeholder="Nová kategorie…"]'), NOVA_KATEGORIE, { popisek: 'Nová kategorie: název…' });
      const sel = `[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.textContent.includes('Pod kterou kolekci')))`;
      await n.cekej(`[...(${sel}).options].some(o => o.textContent.trim() === ${JSON.stringify(NOVA_KOLEKCE)})`, 15000);
      await n.mys(sel);
      await n.popisek('…pod kterou kolekci patří');
      await n.ev(`(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.textContent.includes('Pod kterou kolekci'))); const o = [...s.options].find(o => o.textContent.trim() === ${JSON.stringify(NOVA_KOLEKCE)}) ?? [...s.options].find(o => o.textContent.includes(${JSON.stringify(NOVA_KOLEKCE)})); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await n.snimek(900);
      await n.klik(tl('Založit kategorii'), { popisek: '„Založit kategorii"', po: 1800 });
      await n.popisek('Kolekce i kategorie se v obchodě ukážou, až v nich bude zveřejněný výrobek');
      await n.drz(2000);
    },
  },
  {
    klic: 'zakaznici.prehled',
    oblast: 'admin',
    async hrat(n, ctx) {
      await otevrit(n, ctx, 'zakaznici-workbench', 'Zákazníci');
      await n.popisek('Zákazníci: kdo má účet a kdo nakoupil bez registrace');
      await n.drz(1500);
      await n.mys(tl('Kód pro stálé zákazníky'));
      await n.popisek('„Kód pro stálé zákazníky" — slevový kód, který jim pošlete');
      await n.drz(1800);
      await n.klik(tl('Neregistrovaní'), { popisek: '„Neregistrovaní" — nakoupili bez účtu', po: 1500 });
      await n.klik(tl('Čeká na doplatek'), { popisek: 'Kdo dluží doplatek zakázky', po: 1500 });
      await n.klik(tl('Newsletter'), { popisek: 'Kdo odebírá novinky', po: 1500 });
    },
  },
  {
    klic: 'statistiky.prehled',
    oblast: 'admin',
    async hrat(n, ctx) {
      await otevrit(n, ctx, 'statistiky-workbench', 'Statistiky');
      await n.popisek('Statistiky: tržby, objednávky, co se prodává');
      await n.drz(1600);
      for (const z of ['Objednávky', 'Produkty', 'Zákazníci', 'Sklad', 'Slevy']) await n.klik(tl(z), { popisek: `Záložka „${z}"`, po: 1300 });
    },
  },
  {
    klic: 'newsletter.napsat',
    oblast: 'admin',
    async hrat(n, ctx) {
      await otevrit(n, ctx, 'newsletter', 'Newsletter');
      await n.psat(css('input[placeholder^="Např. Nové objekty"]'), 'Nový výpal je venku', { popisek: 'Předmět e-mailu' });
      await n.psat(`[...document.querySelectorAll('input[placeholder^="Např. Nové objekty"]')][1]`, 'Nový výpal je venku', { popisek: 'Bloky pod sebou: nadpis…' });
      await n.psat(`document.querySelector('textarea, [contenteditable="true"]')`, 'Z pece právě vyšly nové kytky a ptáčci do zahrady. Mrkněte, než se rozeberou.', { popisek: '…odstavec…' });
      await n.klik(tl('+ Produkt'), { popisek: '…a třeba výrobek s fotkou a cenou (+ Produkt)', po: 1500 });
      await n.mys(obs('Náhled e-mailu'));
      await n.popisek('Vpravo hned vidíte, jak e-mail dorazí');
      await n.drz(2000);
      await n.mys(tl('Poslat test na můj e-mail'));
      await n.popisek('Nejdřív „Poslat test na můj e-mail", pak „Odeslat kampaň" všem odběratelům');
      await n.drz(2200);
    },
  },
  {
    klic: 'emaily.prehled',
    oblast: 'admin',
    async hrat(n, ctx) {
      await otevrit(n, ctx, 'emaily', 'Emaily');
      await n.popisek('Emaily: všechno, co zákazníkům chodí — vlevo seznam, vpravo náhled');
      await n.drz(1600);
      await n.klik(tl('Objednávka je na cestě k vám'), { popisek: 'Klikněte na e-mail a uvidíte, jak vypadá', po: 2000 });
      await n.klik(tl('Omlouvám se, objednávka se zdrží'), { po: 2000 });
    },
  },
  {
    klic: 'nastaveni.dovolena',
    oblast: 'admin',
    async hrat(n, ctx) {
      await otevrit(n, ctx, 'dovolena-oznameni', 'Dovolená a oznámení');
      await n.klik(prepinacVRadku('Mám dovolenou'), { popisek: '„Mám dovolenou" — objednávky chodí dál, zákazník uvidí, kdy se vrátíte', po: 1500 });
      await n.nastavit(`document.querySelector('input[type=date]')`, new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), { popisek: 'Datum návratu' });
      await n.psat(`document.querySelector('input[placeholder^="Např.: Jsem u moře"]')`, 'Jsem na dovolené, objednávky vyřídím hned po návratu.', { popisek: 'Vzkaz zákazníkům — ukáže se nahoře na webu' });
      await n.mys(tl('Uložit'));
      await n.popisek('„Uložit" — ode dne návratu se upozornění samo skryje');
      await n.drz(1800);
      /* Mimo záběr: vrátit přepínač (nic se neukládá). */
      await n.ev(`${prepinacVRadku('Mám dovolenou')}?.click()`);
    },
  },
  {
    klic: 'nastaveni.doprava',
    oblast: 'admin',
    async hrat(n, ctx) {
      await otevrit(n, ctx, 'doprava-platba', 'Doprava a platba');
      await n.popisek('Doprava a platba: ceny poštovného a dobírky');
      await n.drz(1800);
      await n.rolovat(tl('Uložit'));
      await n.mys(tl('Uložit'));
      await n.popisek('Změníte číslo a „Uložit" — platí hned pro nové objednávky');
      await n.drz(2000);
    },
  },
  {
    klic: 'nastaveni.pravni',
    oblast: 'admin',
    async hrat(n, ctx) {
      await otevrit(n, ctx, 'pravni', 'Právní údaje');
      await n.popisek('Právní údaje: sídlo, IČO, DPH, lhůty — propisují se do obchodních podmínek');
      await n.drz(2000);
      await n.klik(tl('Texty obchodu'), { popisek: '„Texty obchodu" a „Dokumenty ke stažení"', po: 1800 });
      await n.klik(tl('Právní údaje'), { po: 1200 });
    },
  },
];
