import { dialog, obs, tl } from '../lib/rekorder.mjs';
import { detailObjednavky, novaObjednavka } from './_spolecne.mjs';

/* Zakázky — výroba na zakázku od zadání po doplatek. */
const zakazka = ({ api }) => novaObjednavka(api, { produkt: 'made_to_order', doprava: 'cz_address', platba: 'comgate' });
const krok = async (n, text, popisek, dalsi) => {
  await n.klik(tl(text), { popisek, po: 1300 });
  if (dalsi) { await n.cekej(tl(dalsi), 30000); await n.drz(700); } else { await n.pockej(6000); await n.snimek(900); }
};

export default [
  {
    klic: 'zakazky.postup',
    oblast: 'admin',
    pred: zakazka,
    async hrat(n, ctx, o) {
      await detailObjednavky(n, ctx, o.id);
      await n.popisek('Vpravo „Výroba na zakázku": zadání od zákazníka, záloha, doplatek');
      await n.mys(obs('Zadání od zákazníka'));
      await n.drz(2200);
      await krok(n, 'Potvrdit zadání', 'Zadání je jasné → „Potvrdit zadání" (zákazník dostane e-mail)', 'Začít výrobu');
      await krok(n, 'Začít výrobu', 'Pustíte se do práce → „Začít výrobu"', 'Výroba dokončena');
      await krok(n, 'Výroba dokončena', 'Hotovo → „Výroba dokončena"', null);
      await n.popisek('Dál „Poslat výzvu k doplacení" — zákazník dostane odkaz k zaplacení zbytku');
      await n.mys(tl('Poslat výzvu k doplacení')).catch(() => undefined);
      await n.drz(2600);
    },
  },
  {
    klic: 'zakazky.priplatek',
    oblast: 'admin',
    pred: zakazka,
    async hrat(n, ctx, o) {
      await detailObjednavky(n, ctx, o.id);
      await n.klik(tl('Přidat příplatek'), { popisek: 'Zakázka vyjde dráž? „Přidat příplatek"', po: 800 });
      await n.psat(`document.querySelector('input[type=number][placeholder="0"]')`, '300', { popisek: 'Kolik Kč navíc' });
      await n.klik(`[...document.querySelector('input[type=number][placeholder="0"]').closest('.gap-x-2').querySelectorAll('button')].find(b => b.textContent.trim() === 'Uložit')`, { popisek: '„Uložit" — příplatek se přičte k doplatku', po: 1800 });
      await n.mys(obs('Příplatek'));
      await n.drz(1800);
    },
  },
  {
    klic: 'zakazky.konverzace',
    oblast: 'admin',
    pred: zakazka,
    async hrat(n, ctx, o) {
      await detailObjednavky(n, ctx, o.id);
      await n.klik(tl('Konverzace se zákazníkem'), { popisek: '„Konverzace se zákazníkem" — zprávy chodí e-mailem oběma směry', po: 1300 });
      await n.klik(tl('Zákazníkovi', dialog), { popisek: 'Dole přepněte na „Zákazníkovi" (jinak je to jen poznámka pro vás)', po: 900 });
      const pole = `document.querySelector('textarea[placeholder^="Napište zákazníkovi"]')`;
      await n.psat(pole, 'Dobrý den, posílám fotku glazury — líbí se vám tento odstín?', { popisek: 'Napište zprávu' });
      await n.klik(`document.querySelector('[aria-label="Odeslat"]')`, { popisek: 'Šipkou odešlete — zákazník dostane e-mail a může odpovědět', po: 2200 });
    },
  },
  {
    klic: 'zakazky.poznamka',
    oblast: 'admin',
    pred: zakazka,
    async hrat(n, ctx, o) {
      await detailObjednavky(n, ctx, o.id);
      const pole = `[...document.querySelectorAll('textarea')].find(t => /Jen pro ateliér/.test(t.placeholder))`;
      await n.psat(pole, 'Glazura zelená č. 4, vypálit do pátku.', { popisek: 'Interní poznámka — vidíte jen vy, zákazník ne' });
      await n.klik(tl('Uložit poznámku'), { popisek: '„Uložit poznámku"', po: 1800 });
    },
  },
];
