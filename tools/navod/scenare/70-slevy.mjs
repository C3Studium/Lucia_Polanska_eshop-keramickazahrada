import { dialog, obs, tl } from '../lib/rekorder.mjs';

/* Slevy — výprodej pro víc výrobků, slevový kód. */
const KOD = 'JARO10';
const naSlevy = async (n, ctx, zalozka) => {
  await ctx.admin(n);
  await n.jdi(`${ctx.ADMIN}/app/slevy-workbench`, { cekej: `document.body.textContent.includes('Zlevněné výrobky')`, pauza: 2500 });
  await n.drz(900);
  if (zalozka) await n.klik(tl(zalozka), { popisek: `Slevy → záložka „${zalozka}"`, po: 1200 });
};

export default [
  {
    klic: 'slevy.vyprodej-novy',
    oblast: 'admin',
    pred: async ({ api }) => ({ start: Date.now() }),
    po: async ({ api }) => {
      const { vyprodeje } = await api('/admin/workbench/vyprodeje').catch(() => ({ vyprodeje: [] }));
      for (const v of vyprodeje ?? []) if ((v.collections ?? []).some((c) => c.title === 'Květiny')) await api(`/admin/workbench/vyprodeje/${v.id}`, null, 'DELETE').catch(() => undefined);
    },
    async hrat(n, ctx) {
      await naSlevy(n, ctx, 'Výprodeje');
      await n.klik(tl('Nový výprodej'), { popisek: '„Nový výprodej"', cekej: dialog, po: 1200 });
      await n.klik(tl('Do vyprodání zásob', dialog), { popisek: '1. Typ: „Na čas" (od–do), nebo „Do vyprodání zásob"', po: 1200 });
      await n.klik(tl('Další', dialog), { po: 1000 });
      await n.klik(tl('Kolekce', dialog), { popisek: '2. Výrobky: celá kolekce, kategorie, nebo vybrané kusy', po: 900 });
      await n.klik(`[...${dialog}.querySelectorAll('label, button')].find(e => e.textContent.trim().startsWith('Květiny'))`, { popisek: 'Zaškrtněte, co se zlevní', po: 1200 });
      await n.klik(tl('Další', dialog), { po: 1000 });
      await n.klik(tl('20 %', dialog), { popisek: '3. Sleva v procentech — dole uvidíte, kolik výrobků se zlevní', po: 1500 });
      await n.klik(tl('Spustit výprodej', dialog), { popisek: '„Spustit výprodej"', po: 2200 });
      await n.popisek('Výprodej běží — u výrobků v obchodě je přeškrtnutá cena a název výprodeje');
      await n.drz(2000);
    },
  },
  {
    klic: 'slevy.kod',
    oblast: 'admin',
    po: async ({ api }) => {
      const { promotions } = await api(`/admin/promotions?code=${KOD}&fields=id,code`).catch(() => ({ promotions: [] }));
      for (const p of promotions ?? []) await api(`/admin/promotions/${p.id}`, null, 'DELETE').catch(() => undefined);
    },
    async hrat(n, ctx) {
      await naSlevy(n, ctx, 'Akce a kódy');
      await n.klik(tl('Nová sleva'), { popisek: 'Slevový kód do košíku: „Nová sleva"', cekej: dialog, po: 1200 });
      await n.psat(`document.getElementById('discount-code')`, KOD, { popisek: 'Kód, který zákazník napíše v pokladně' });
      await n.psat(`document.getElementById('discount-value')`, '10', { popisek: 'Kolik — procenta nebo pevná částka' });
      await n.mys(obs('Co sleva dělá', dialog));
      await n.popisek('Co sleva dělá: sleva z objednávky, nebo doprava zdarma');
      await n.drz(1600);
      await n.klik(`[...${dialog}.querySelectorAll('button')].filter(b => !b.disabled && b.getClientRects().length).pop()`, { popisek: 'Uložte — kód hned platí (ne na zlevněné výrobky)', po: 2200 });
    },
  },
];
