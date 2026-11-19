import { dialog, obs, tl, txt } from '../lib/rekorder.mjs';

/* Kolekce a kategorie — zařazení výrobků. */
const PTACEK = 'Keramický ptáček na noze - zahradní dekorace';

const najdiVyrobek = async (api, title) => {
  const { products } = await api(`/admin/products?limit=5&fields=id,title,collection_id,categories.id&q=${encodeURIComponent(title)}`);
  const p = products.find((x) => x.title === title);
  if (!p) throw new Error('Ve sandboxu chybí výrobek ' + title);
  return p;
};
const zaloha = async ({ api }) => {
  const p = await najdiVyrobek(api, PTACEK);
  return { id: p.id, zarazeni: { collection_id: p.collection_id, categories: p.categories.map((c) => ({ id: c.id })) } };
};
const obnovit = async ({ api }, z) => z && api(`/admin/products/${z.id}`, z.zarazeni);

export const radekRozdeleni = (title) =>
  `[...document.querySelectorAll('div')].find(d => d.querySelector(':scope > input[type=checkbox]') && d.textContent.includes(${JSON.stringify(title)}))`;

const doPanelu = async (n, ctx) => {
  await ctx.admin(n);
  await n.jdi(`${ctx.ADMIN}/app/rozdeleni`, { cekej: `document.querySelectorAll('input[type=checkbox]').length > 5`, pauza: 2500 });
  await n.drz(900);
  await n.klik(tl('Ptáčci a jiné drobnosti'), { popisek: 'Vlevo klikněte na kolekci, kde výrobek je', po: 1000 });
  await n.klik(`${radekRozdeleni(PTACEK)}.querySelector('input[type=checkbox]')`, { popisek: 'Zaškrtněte výrobek (i víc najednou)' });
  await n.klik(tl('Zařadit vybrané'), { popisek: 'Klikněte na „Zařadit vybrané"', cekej: dialog, po: 1200 });
};

const vysledekNaDetailu = async (n, ctx, z, text) => {
  await n.popisek(text);
  await n.jdi(`${ctx.ADMIN}/app/produkt/${z.id}`, { cekej: `document.getElementById('produkt-zarazeni')`, pauza: 2500 });
  await n.ev(`document.getElementById('produkt-zarazeni').scrollIntoView({ block: 'center' })`);
  await n.drz(600);
  await n.mys(`document.getElementById('produkt-zarazeni')`);
  await n.drz(2600);
};

export default [
  {
    klic: 'zarazeni.presunout',
    oblast: 'admin',
    pred: zaloha,
    po: obnovit,
    async hrat(n, ctx, z) {
      await doPanelu(n, ctx);
      await n.klik(tl('Přesunout sem', dialog), { popisek: '„Přesunout sem" — z původního místa zmizí' });
      await n.klik(tl('Do zahrady a na fasádu', dialog), { popisek: 'Vyberte kolekci' });
      await n.klik(tl('Sochy a sošky', dialog), { popisek: 'Zaškrtněte kategorii (můžete víc)' });
      await n.mys(obs('Po uložení', dialog));
      await n.drz(1400);
      await n.klik(`[...${dialog}.querySelectorAll('button')].find(b => b.textContent.trim() === 'Uložit')`, { popisek: 'Uložte', po: 1200 });
      await vysledekNaDetailu(n, ctx, z, 'Výrobek je teď JEN v Do zahrady a na fasádu › Sochy a sošky');
    },
  },
  {
    klic: 'zarazeni.pridat',
    oblast: 'admin',
    pred: zaloha,
    po: obnovit,
    async hrat(n, ctx, z) {
      await doPanelu(n, ctx);
      await n.klik(tl('Přidat i sem', dialog), { popisek: '„Přidat i sem" — zůstane, kde je, a přibude' });
      await n.klik(tl('Do zahrady a na fasádu', dialog), { popisek: 'Vyberte kolekci' });
      await n.klik(tl('Sochy a sošky', dialog), { popisek: 'Zaškrtněte kategorii' });
      await n.mys(obs('Po uložení', dialog));
      await n.drz(1400);
      await n.klik(`[...${dialog}.querySelectorAll('button')].find(b => b.textContent.trim() === 'Uložit')`, { popisek: 'Uložte', po: 1200 });
      await vysledekNaDetailu(n, ctx, z, 'Výrobek je teď na OBOU místech — původním i novém');
    },
  },
];
