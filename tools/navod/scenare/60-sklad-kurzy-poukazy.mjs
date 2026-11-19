import { aria, dialog, obs, tl } from '../lib/rekorder.mjs';
import { KYTKA, obnovitVyrobek, zalohaVyrobku } from './_spolecne.mjs';

/* Sklad, kurzy, dárkové poukazy. */
const posledniTlacitko = (scope) => `[...${scope}.querySelectorAll('button')].filter(b => !b.disabled && b.getClientRects().length).pop()`;

export default [
  {
    klic: 'sklad.naskladnit',
    oblast: 'admin',
    pred: async ({ api }) => [await zalohaVyrobku(api, KYTKA), await zalohaVyrobku(api, 'Keramické kytičky - různé barvy')],
    po: async ({ api }, z) => { for (const x of z ?? []) await obnovitVyrobek(api, x); },
    async hrat(n, ctx) {
      await ctx.admin(n);
      await n.jdi(`${ctx.ADMIN}/app/sklad-workbench`, { cekej: `document.body.textContent.includes('Naskladnit po výpalu')`, pauza: 2500 });
      await n.drz(900);
      await n.klik(tl('Naskladnit po výpalu'), { popisek: 'Vyšlo z pece? „Naskladnit po výpalu"', cekej: `document.querySelector('input[placeholder="+ ks"]')`, po: 1200 });
      await n.psat(`document.querySelector('input[placeholder^="Hledat název"]')`, 'kyt', { popisek: 'Výrobek najdete hledáním' });
      await n.pockej(800);
      await n.psat(aria(`Kolik kusů přibylo — ${KYTKA}`), '3', { popisek: 'U každého napište, kolik kusů přibylo' });
      await n.psat(aria('Kolik kusů přibylo — Keramické kytičky'), '5');
      await n.mys(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Naskladnit ('))`);
      await n.popisek('Dole „Naskladnit" uloží všechno najednou');
      await n.drz(1200);
      await n.klik(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Naskladnit ('))`, { po: 2200 });
    },
  },
  {
    klic: 'sklad.prehled',
    oblast: 'admin',
    async hrat(n, ctx) {
      await ctx.admin(n);
      await n.jdi(`${ctx.ADMIN}/app/sklad-workbench`, { cekej: `document.body.textContent.includes('Naskladnit po výpalu')`, pauza: 2500 });
      await n.popisek('Zásoby: kolik kusů máte; nahoře to, o co je zájem');
      await n.drz(1800);
      await n.klik(tl('Dochází'), { popisek: '„Dochází" — zbývá pár kusů', po: 1400 });
      await n.klik(tl('Vyprodáno'), { popisek: '„Vyprodáno" — nula kusů', po: 1400 });
      await n.klik(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '+' && b.getClientRects().length)`, { popisek: '+ / − u řádku upraví počet hned', po: 1500 });
    },
  },
  {
    klic: 'kurzy.novy-termin',
    oblast: 'admin',
    async hrat(n, ctx) {
      await ctx.admin(n);
      await n.jdi(`${ctx.ADMIN}/app/kurzy-sprava`, { cekej: `document.body.textContent.includes('Nový termín')`, pauza: 2500 });
      await n.drz(900);
      await n.klik(tl('Nový termín'), { popisek: 'Kurzy → „Nový termín"', cekej: dialog, po: 1200 });
      await n.psat(`document.getElementById('wizard-title')`, 'Točení na kruhu pro začátečníky', { popisek: 'Název kurzu' });
      const den = `(() => { const d = new Date(Date.now() + 9 * 864e5).getDate(); return [...${dialog}.querySelectorAll('button')].find(b => b.textContent.trim() === String(d) && !b.disabled); })()`;
      await n.klik(den, { popisek: 'V kalendáři klikněte na dny, kdy se kurz koná', po: 900 });
      await n.nastavit(`document.getElementById('wizard-time')`, '17:00', { popisek: 'Čas začátku, délka a kapacita' });
      await n.psat(`document.getElementById('wizard-capacity')`, '6');
      await n.klik(tl('Dál — ceny', dialog), { popisek: '„Dál — ceny"', cekej: `document.getElementById('wizard-price-single')`, po: 1200 });
      await n.psat(`document.getElementById('wizard-price-single')`, '890', { popisek: 'Cena za osobu (dítě a skupina nepovinné)' });
      await n.psat(`document.getElementById('wizard-price-child')`, '590').catch(() => undefined);
      await n.mys(posledniTlacitko(dialog));
      await n.popisek('Uložit — termín se ukáže na webu v Kurzech');
      await n.drz(1500);
      await n.klik(posledniTlacitko(dialog), { po: 2200 });
    },
  },
  {
    klic: 'poukazy.novy',
    oblast: 'admin',
    async hrat(n, ctx) {
      await ctx.admin(n);
      await n.jdi(`${ctx.ADMIN}/app/poukazy`, { cekej: `document.body.textContent.includes('Nový poukaz')`, pauza: 2500 });
      await n.popisek('Poukazy: prodané i ručně vystavené, se zůstatkem');
      await n.drz(1500);
      await n.klik(tl('Nový poukaz'), { popisek: '„Nový poukaz" — třeba když zákazník platí na místě', cekej: dialog, po: 1200 });
      const pole = `[...${dialog}.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio])')].filter(i => i.getClientRects().length)`;
      await n.psat(`${pole}[0]`, '1000', { popisek: 'Hodnota v Kč' });
      await n.psat(`${dialog}.querySelector('input[placeholder^="např. Jana"]')`, 'Marie Horáková', { popisek: 'Pro koho (jméno na poukazu)' }).catch(() => undefined);
      await n.psat(`${dialog}.querySelector('[placeholder^="Všechno nejlepší"]')`, 'Všechno nejlepší k narozeninám!', { popisek: 'Věnování (nepovinné)' }).catch(() => undefined);
      await n.mys(posledniTlacitko(dialog));
      await n.popisek('Uložit — vznikne kód poukazu a PDF k tisku');
      await n.drz(1800);
    },
  },
];
