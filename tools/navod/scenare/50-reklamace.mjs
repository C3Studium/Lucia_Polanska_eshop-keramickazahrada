import { dialog, obs, tl } from '../lib/rekorder.mjs';
import { novaObjednavka, podatZadost } from './_spolecne.mjs';

/* Reklamace a vrácení — žádost od zákazníka až po vrácení peněz. */
const zadost = (kind, reason) => async ({ api }) => {
  const o = await novaObjednavka(api, { vyrobek: 'Keramická kytka bílá, kopretina, žlutý střed', platba: 'comgate' });
  await podatZadost(api, { orderId: o.id, kind, reason });
  return o;
};
const otevritZadost = async (n, ctx, o) => {
  await ctx.admin(n);
  await n.jdi(`${ctx.ADMIN}/app/reklamace`, { cekej: `document.querySelector('table, [role=table]') || document.body.textContent.includes('Nové')`, pauza: 2500 });
  await n.drz(900);
  await n.klik(`[...document.querySelectorAll('tr, a, [role=row]')].find(r => r.textContent.includes('#${o.display_id}'))`, { popisek: 'Klikněte na žádost', cekej: `document.body.textContent.includes('Průběh') || document.body.textContent.includes('PRŮBĚH')`, po: 1500 });
};

export default [
  {
    klic: 'reklamace.vyrizeni',
    oblast: 'admin',
    pred: zadost('reklamace', 'Kytka přišla s prasklým okvětním lístkem.'),
    async hrat(n, ctx, o) {
      await otevritZadost(n, ctx, o);
      await n.popisek('Nahoře průběh, vpravo akce a platby');
      await n.mys(obs('Zákonná lhůta'));
      await n.drz(1800);
      await n.klik(tl('Schválit'), { popisek: 'Reklamace oprávněná → „Schválit"', po: 1200 });
      await n.mys(obs('Způsob vyřízení'));
      await n.popisek('Vyberte způsob (vrácení peněz / výměna) a případně poznámku');
      await n.drz(1800);
      await n.klik(tl('Schválit a poslat e-mail'), { popisek: '„Schválit a poslat e-mail"', po: 1800 });
      await n.pockej(1500);
      await n.klik(tl('Zboží přijato'), { popisek: 'Zboží dorazilo zpět → „Zboží přijato"', po: 900 });
      await n.klik(`[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Zboží přijato').pop()`, { popisek: 'Potvrďte', po: 1800 });
      await n.pockej(1200);
      await n.klik(`[...document.querySelectorAll('table input[type=checkbox], table button[role=checkbox]')].find(c => c.getClientRects().length)`, { popisek: 'Košík vrácení: zaškrtněte, co vracíte', po: 1200 }).catch(() => undefined);
      const vratit = `[...document.querySelectorAll('button[type=submit]')].find(b => /^Vrátit \\d/.test(b.textContent.replace(/\\s+/g, ' ').trim()) && !b.disabled)`;
      await n.cekej(vratit, 15000);
      await n.klik(vratit, { popisek: '„Vrátit … Kč" — peníze odejdou zákazníkovi (kartou přes ComGate)', po: 2000 });
      if (await n.ev(`!!${dialog}`)) await n.klik(`[...${dialog}.querySelectorAll('button')].filter(b => !b.disabled).pop()`, { popisek: 'Potvrďte vrácení', po: 2000 });
      await n.pockej(2500);
      await n.snimek(800);
      await n.klik(tl('Vyřízeno'), { popisek: 'Peníze vráceny → „Vyřízeno"', po: 900 }).catch(() => undefined);
      await n.klik(tl('Vyřízeno a poslat potvrzení'), { popisek: '„Vyřízeno a poslat potvrzení"', po: 1800 }).catch(() => undefined);
      await n.popisek('Každý krok pošle zákazníkovi e-mail; peníze se vrací jen tlačítkem');
      await n.drz(2200);
    },
  },
  {
    klic: 'reklamace.zamitnout',
    oblast: 'admin',
    pred: zadost('reklamace', 'Glazura má jinou barvu než na fotce.'),
    async hrat(n, ctx, o) {
      await otevritZadost(n, ctx, o);
      await n.klik(tl('Zamítnout'), { popisek: 'Reklamace neoprávněná → „Zamítnout"', po: 1000 });
      await n.psat(`document.querySelector('textarea')`, 'Barva glazury se u ručně dělané keramiky může lišit, jak uvádí popis výrobku.', { popisek: 'Napište odůvodnění — povinné, zákazník ho uvidí' });
      await n.mys(tl('Zamítnout a poslat e-mail'));
      await n.popisek('„Zamítnout a poslat e-mail" — odejde i poučení o možnosti obrátit se na ČOI');
      await n.drz(2000);
    },
  },
];
