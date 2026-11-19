import { aria, dialog, obs, tl, txt } from '../lib/rekorder.mjs';
import { detailObjednavky, novaObjednavka } from './_spolecne.mjs';

/* Objednávky — od nové po odeslání / vyzvednutí. Každý scénář si založí
   čerstvou objednávku (smoke-order), takže jde natočit kdykoli znovu. */
const postup = `[...document.querySelectorAll('section, div')].find(d => d.querySelector(':scope > * h2, :scope h2')?.textContent.trim() === 'Postup objednávky')`;
const hlavniKrok = (text) => tl(text);

export default [
  {
    klic: 'objednavky.seznam',
    oblast: 'admin',
    celeOkno: true,
    pred: ({ api }) => novaObjednavka(api, { vyrobek: 'Keramická kytka přírodní, červený střed', platba: 'comgate' }),
    async hrat(n, ctx, o) {
      await ctx.admin(n);
      await n.jdi(`${ctx.ADMIN}/app/prehled`, { pauza: 3000 });
      await n.klik(tl('Objednávky'), { popisek: 'V menu klikněte na „Objednávky"', cekej: `location.pathname.includes('objednavky')`, po: 1500 });
      await n.klik(tl('Nové'), { popisek: '„Nové" — co ještě nikdo nezačal připravovat', po: 1500 });
      await n.klik(tl('Připravujeme'), { popisek: 'Záložky jdou podle toho, kde objednávka je', po: 1200 });
      await n.klik(tl('K odeslání'), { po: 1200 });
      await n.klik(tl('Nové'), { po: 1000 });
      await n.klik(tl(`#${o.display_id}`), { popisek: 'Klik na objednávku otevře detail', cekej: `[...document.querySelectorAll('h2')].some(h => h.textContent.includes('Postup objednávky'))`, po: 2200 });
    },
  },
  {
    klic: 'objednavky.postup',
    oblast: 'admin',
    pred: ({ api }) => novaObjednavka(api, { vyrobek: 'Keramické kytičky - různé barvy', platba: 'comgate' }),
    async hrat(n, ctx, o) {
      await detailObjednavky(n, ctx, o.id);
      await n.popisek('„Postup objednávky" — kde objednávka je a co dál');
      await n.mys(obs('Postup objednávky'));
      await n.drz(1600);
      await n.klik(hlavniKrok('Začít připravovat'), { popisek: '„Začít připravovat" — zákazníkovi odejde e-mail', po: 1500 });
      await n.popisek('5 vteřin jde krok vrátit („Vrátit zpět"), pak se provede');
      await n.cekej(`${hlavniKrok('Zabaleno, připraveno k odeslání')}`, 30000);
      await n.drz(1200);
      await n.klik(hlavniKrok('Zabaleno, připraveno k odeslání'), { popisek: 'Zabalíte → „Zabaleno, připraveno k odeslání"', po: 1500 });
      await n.cekej(`${hlavniKrok('Označit jako odeslané')}`, 30000);
      await n.popisek('Pak vytisknete štítek České pošty (oddíl „Štítek České pošty")');
      await n.mys(obs('Štítek České pošty'));
      await n.drz(2000);
      await n.klik(hlavniKrok('Označit jako odeslané'), { popisek: 'Po předání poště „Označit jako odeslané"', po: 1500 });
      const ok = await n.ev(`!!${dialog}`);
      if (ok) {
        await n.drz(1200);
        await n.klik(`[...${dialog}.querySelectorAll('button')].filter(b => !b.disabled).pop()`, { po: 1800 });
      }
      await n.pockej(6000);
      await n.popisek('Hotovo — zákazník dostal e-mail s číslem zásilky');
      await n.drz(1800);
    },
  },
  {
    klic: 'objednavky.odber',
    oblast: 'admin',
    pred: ({ api }) => novaObjednavka(api, { vyrobek: 'Zvonkové tlačítko, Hvězdné', doprava: 'pickup', platba: 'pickup' }),
    async hrat(n, ctx, o) {
      await detailObjednavky(n, ctx, o.id);
      await n.popisek('Osobní odběr — platí se při vyzvednutí');
      await n.mys(obs('Postup objednávky'));
      await n.drz(1400);
      await n.klik(hlavniKrok('Připraveno k vyzvednutí'), { popisek: 'Máte připraveno → „Připraveno k vyzvednutí" (zákazník dostane e-mail)', po: 1500 });
      await n.popisek('5 vteřin jde krok vrátit, pak se provede');
      await n.cekej(`${hlavniKrok('Vyzvednuto')}`, 30000);
      await n.drz(1000);
      await n.klik(hlavniKrok('Vyzvednuto'), { popisek: 'Zákazník si přišel a zaplatil → „Vyzvednuto a zaplaceno"', po: 1500 });
      const ok = await n.ev(`!!${dialog}`);
      if (ok) {
        await n.drz(1200);
        await n.klik(`[...${dialog}.querySelectorAll('button')].filter(b => !b.disabled).pop()`, { po: 1800 });
      }
      await n.pockej(6000);
      await n.popisek('Hotovo — objednávka je vyřízená, faktura odejde e-mailem');
      await n.drz(2000);
    },
  },
  {
    klic: 'objednavky.zpozdeni',
    oblast: 'admin',
    pred: ({ api }) => novaObjednavka(api, { vyrobek: 'Ještěrka na kameni', platba: 'comgate' }),
    async hrat(n, ctx, o) {
      await detailObjednavky(n, ctx, o.id);
      await n.klik(tl('Zpoždění'), { popisek: 'Objednávka se zdrží? Vpravo „Zpoždění"', po: 1000 });
      await n.klik(tl('Oznámit zpoždění'), { popisek: '„Oznámit zpoždění"', po: 1200 });
      const datum = `document.querySelector('input[id^="delay-date-"]')`;
      await n.klik(datum, { popisek: 'Vyberte nový termín', po: 300 });
      await n.ev(`(() => { const i = ${datum}; const d = new Date(Date.now() + 10 * 864e5); const v = d.toISOString().slice(0, 10); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await n.snimek(900);
      await n.psat(`document.querySelector('textarea[id^="delay-reason-"]')`, 'Glazura potřebuje ještě jeden výpal.', { popisek: 'Důvod (nepovinné — zákazník ho uvidí)' });
      await n.klik(tl('Poslat zákazníkovi omluvu'), { popisek: '„Poslat zákazníkovi omluvu" — odejde e-mail s novým termínem', po: 2000 });
      await n.popisek('U objednávky je vidět štítek „Nový termín"');
      await n.drz(2200);
    },
  },
];
