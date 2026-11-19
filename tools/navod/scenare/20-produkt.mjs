import { aria, dialog, obs, prepinac, tl, txt } from '../lib/rekorder.mjs';
import { PITKO, detail, obnovitVyrobek, zalohaVyrobku } from './_spolecne.mjs';

/* Detail výrobku — co Lucie dělá nejčastěji. Všechno na pítku s vlnitým
   okrajem; po scénáři se výrobek vrátí do původního stavu. */
const pred = ({ api }) => zalohaVyrobku(api, PITKO);
const po = ({ api }, z) => obnovitVyrobek(api, z);
const ulozitDialog = (text) => `[...${dialog}.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})`;

export default [
  {
    klic: 'produkt.zverejnit',
    oblast: 'admin',
    pred: async (ctx) => { const z = await pred(ctx); await ctx.api(`/admin/products/${z.id}`, { status: 'draft' }); return z; },
    po,
    async hrat(n, ctx, z) {
      await detail(n, ctx, z.id);
      await n.popisek('Oranžový rámeček a pruh = výrobek je SKRYTÝ, zákazníci ho nevidí');
      await n.mys(obs('Skryto — zákazníci tento výrobek'));
      await n.drz(2200);
      await n.klik(tl('Zveřejnit v obchodě'), { popisek: 'Klikněte na „Zveřejnit v obchodě"', po: 1600 });
      await n.popisek('Hotovo — zelený štítek „Publikováno", výrobek je v obchodě');
      await n.mys(obs('Publikováno'));
      await n.drz(1800);
      await n.klik(aria('Další akce'), { popisek: 'Skrýt ho jde zase přes tlačítko „…"', po: 900 });
      await n.klik(tl('Skrýt z obchodu'), { popisek: 'Vyberte „Skrýt z obchodu"', po: 1800 });
    },
  },
  {
    klic: 'produkt.popis',
    oblast: 'admin',
    pred,
    po,
    async hrat(n, ctx, z) {
      await detail(n, ctx, z.id);
      const pole = `document.querySelector('#produkt-popis textarea')`;
      await n.klik(pole, { popisek: 'Klikněte do popisu a pište', po: 300 });
      await n.ev(`(() => { const t = ${pole}; t.focus(); t.setSelectionRange(t.value.length, t.value.length); t.scrollTop = t.scrollHeight; })()`);
      await n.S('Input.insertText', { text: '\n\n' });
      for (const kus of ['Vhodné ', 'i jako ', 'dárek ', 'pro zahrádkáře.']) { await n.S('Input.insertText', { text: kus }); await n.snimek(110); }
      await n.klik(`document.querySelector('#produkt-popis h2')`, { popisek: 'Klikněte jinam — popis se uloží sám', po: 400 });
      await n.mys(obs('Uloženo')).catch(() => undefined);
      await n.drz(1800);
    },
  },
  {
    klic: 'produkt.cena',
    oblast: 'admin',
    pred,
    po,
    async hrat(n, ctx, z) {
      await detail(n, ctx, z.id);
      await n.rolovat(`document.getElementById('produkt-cena')`);
      const cena = `[...document.querySelectorAll('#produkt-cena input')].find(i => /^\\d+$/.test(i.value) && Number(i.value) > 50)`;
      await n.psat(cena, '390', { popisek: 'Cena: přepište číslo' });
      await n.klavesa('Enter', { po: 1200 });
      await n.klik(aria('Přidat kus'), { popisek: 'Sklad: + přidá kus, − ubere', po: 500 });
      await n.klik(aria('Přidat kus'), { po: 900 });
      await n.popisek('Změny se ukládají hned');
      await n.drz(1600);
    },
  },
  {
    klic: 'produkt.doprava',
    oblast: 'admin',
    pred,
    po,
    async hrat(n, ctx, z) {
      await detail(n, ctx, z.id);
      await n.rolovat(aria('Velikost zásilky'));
      await n.klik(`${aria('Velikost zásilky')}.querySelectorAll('button')[1]`, { popisek: 'Velikost zásilky: Malé, Velké, nebo Poukaz', po: 1200 });
      await n.klik(prepinac('Křehké'), { popisek: '„Křehké" — Česká pošta s ním zachází opatrně', po: 1000 });
      await n.klik(prepinac('Dobírka'), { popisek: '„Dobírka" — jestli jde platit při převzetí', po: 1000 });
      await n.drz(1200);
    },
  },
  {
    klic: 'produkt.sleva',
    oblast: 'admin',
    pred,
    po,
    async hrat(n, ctx, z) {
      await detail(n, ctx, z.id);
      await n.rolovat(`document.getElementById('produkt-sleva')`);
      await n.klik(tl('Přidat slevu'), { popisek: 'U řádku „Sleva" klikněte na „Přidat slevu"', cekej: dialog, po: 900 });
      await n.klik(tl('20 %', dialog), { popisek: 'Vyberte, o kolik procent', po: 900 });
      await n.mys(obs('Od', dialog));
      await n.popisek('Od kdy a do kdy — „Do" nechte prázdné, když sleva platí do odvolání');
      await n.drz(2200);
      await n.klik(ulozitDialog('Nastavit slevu'), { popisek: 'Klikněte na „Nastavit slevu"', cekej: aria('Sleva zapnutá'), po: 1500 });
      await n.popisek('Sleva běží — přepínačem ji kdykoli vypnete');
      await n.mys(aria('Sleva zapnutá'));
      await n.drz(1500);
      await n.klik(aria('Sleva zapnutá'), { po: 1500 });
    },
  },
  {
    klic: 'produkt.vyprodej-vlastni',
    oblast: 'admin',
    pred,
    po: async (ctx, z) => {
      if (!z) return;
      const { vyprodeje } = await ctx.api('/admin/workbench/vyprodeje').catch(() => ({ vyprodeje: [] }));
      for (const x of vyprodeje ?? []) if ((x.products ?? []).some((p) => p.id === z.id) && x.products.length === 1) await ctx.api(`/admin/workbench/vyprodeje/${x.id}`, null, 'DELETE').catch(() => undefined);
      await obnovitVyrobek(ctx.api, z);
    },
    async hrat(n, ctx, z) {
      await detail(n, ctx, z.id);
      await n.rolovat(`document.getElementById('produkt-vyprodej-vlastni')`);
      await n.klik(tl('Nastavit výprodej'), { popisek: '„Výprodej tohoto produktu" → „Nastavit výprodej"', cekej: dialog, po: 900 });
      await n.klik(tl('Do vyprodání zásob', dialog), { popisek: 'Do vyprodání zásob — skončí sám, až se kus prodá', po: 900 });
      await n.klik(tl('30 %', dialog), { popisek: 'Vyberte slevu', po: 900 });
      const ulozit = `[...${dialog}.querySelectorAll('button')].filter(b => !b.disabled).pop()`;
      await n.klik(ulozit, { popisek: 'Uložte', po: 1800 });
      await n.popisek('Výrobek je ve výprodeji — v obchodě s přeškrtnutou cenou');
      await n.mys(`document.getElementById('produkt-vyprodej-vlastni')`);
      await n.drz(1800);
    },
  },
  {
    klic: 'produkt.zarazeni',
    oblast: 'admin',
    pred,
    po,
    async hrat(n, ctx, z) {
      await detail(n, ctx, z.id);
      await n.rolovat(`document.getElementById('produkt-zarazeni')`);
      await n.popisek('Řádek = kolekce, vedle její kategorie');
      await n.mys(`document.getElementById('produkt-zarazeni')`);
      await n.drz(1500);
      await n.klik(tl('+ Přidat do kolekce'), { popisek: 'Další kolekce: „+ Přidat do kolekce"', po: 700 });
      await n.klik(`[...document.querySelectorAll('[role=option]')].find(o => o.textContent.includes('Ptáčci a jiné drobnosti'))`, { popisek: 'Vyberte kolekci', po: 1000 });
      await n.klik(`[...document.querySelectorAll('#produkt-zarazeni button')].filter(b => b.textContent.includes('+ Kategorie')).pop()`, { popisek: 'U nové kolekce vyberte kategorii', po: 700 });
      await n.klik(`[...document.querySelectorAll('[role=option]')].find(o => o.textContent.includes('Dekorace a zápichy'))`, { po: 1500 });
      await n.popisek('Výrobek se teď v obchodě ukáže v obou kolekcích');
      await n.drz(1600);
      await n.klik(aria('Vyndat z kolekce Ptáčci'), { popisek: '× výrobek z kolekce zase vyndá', po: 1500 });
    },
  },
  {
    klic: 'produkt.bez-skladu',
    oblast: 'admin',
    pred: async (ctx) => {
      const z = await pred(ctx);
      for (const v of z.product.variants) await ctx.api(`/admin/products/${z.id}/variants/${v.id}`, { allow_backorder: false });
      return z;
    },
    po,
    async hrat(n, ctx, z) {
      await detail(n, ctx, z.id);
      await n.klik(prepinac('Objednání bez kusů na skladu'), { popisek: 'Zapněte „Objednání bez kusů na skladu"', po: 1200 });
      const zprava = `document.querySelector('input[placeholder^="např. Vyrobíme"]')`;
      await n.psat(zprava, 'Vyrobíme pro vás do 3 týdnů.', { popisek: 'Napište, co zákazník uvidí (třeba za jak dlouho)' });
      await n.klik(txt('Materiál a rozměry'), { popisek: 'Klikněte jinam — uloží se', po: 1200 });
      await n.popisek('Zákazník koupí i vyprodaný kus a uvidí vaši zprávu');
      await n.drz(1800);
    },
  },
  {
    klic: 'produkt.poskozeny',
    oblast: 'admin',
    pred,
    po,
    async hrat(n, ctx, z) {
      await detail(n, ctx, z.id);
      await n.klik(prepinac('Poškozený kus'), { popisek: 'Zapněte „Poškozený kus"', po: 1600 });
      await n.popisek('Kus se v obchodě ukáže mezi poškozenými; po prodeji se sám skryje');
      await n.mys(prepinac('Poškozený kus'));
      await n.drz(2000);
    },
  },
];
