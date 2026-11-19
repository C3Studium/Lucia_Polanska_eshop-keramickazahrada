import { css, tl } from '../lib/rekorder.mjs';
import { obchod, prihlasitMimoZaber, zakaznik } from './_obchod.mjs';

/* Obchod — účet zákazníka (registrace, heslo, adresy, objednávky, kurzy). */
const pole = (testid) => css(`[data-testid="${testid}"]`);

export default [
  {
    klic: 'obchod.registrace',
    oblast: 'store',
    celeOkno: true,
    async hrat(n, ctx) {
      await obchod(n, ctx, '/cz', { cekej: `document.querySelector('header, nav')` });
      await n.klik(`[...document.querySelectorAll('a, button')].find(a => /account/.test(a.getAttribute('href') ?? '') && a.getClientRects().length)`, { popisek: 'Vpravo nahoře ikona postavičky', cekej: pole('email-input'), po: 1500 });
      await n.pockej(2500);
      await n.klik(tl('Založte si účet'), { popisek: 'Nemáte účet? „Založte si účet"', cekej: pole('first-name-input'), po: 1200 });
      await n.psat(pole('first-name-input'), 'Marie', { popisek: 'Jméno, příjmení, e-mail a heslo' });
      await n.psat(pole('last-name-input'), 'Horáková');
      await n.psat(pole('email-input'), `marie.${Date.now().toString(36)}@sandbox.test`);
      await n.psat(pole('password-input'), 'Keramika-2026');
      for (let i = 0; i < 3; i++) {
        const box = `[...document.querySelectorAll('[data-testid="register-page"] input[type=checkbox], [data-testid="register-page"] button[role=checkbox]')].filter(c => !(c.checked || c.getAttribute('aria-checked') === 'true'))[0]`;
        if (!(await n.ev(`!!(${box})`))) break;
        await n.klik(box, { popisek: 'Odsouhlaste podmínky', po: 500 });
      }
      await n.klik(`document.querySelector('[data-testid="register-page"] button[type=submit]')`, { popisek: 'Odešlete — přijde e-mail s potvrzením', po: 2500 });
      await n.popisek('Potvrďte odkaz v e-mailu a účet je hotový');
      await n.drz(2200);
    },
  },
  {
    klic: 'obchod.heslo',
    oblast: 'store',
    celeOkno: true,
    async hrat(n, ctx) {
      await obchod(n, ctx, '/cz/account', { cekej: pole('email-input') });
      await n.klik(tl('Zapomněli jste heslo?'), { popisek: '„Zapomněli jste heslo?"', cekej: `location.pathname.includes('forgot-password')`, po: 1800 });
      await n.psat(`document.querySelector('input[type=email], input[name=email]')`, 'jana.novakova@sandbox.test', { popisek: 'Napište e-mail, se kterým jste se registrovali' });
      await n.klik(`[...document.querySelectorAll('button[type=submit]')].filter(b => b.getClientRects().length).pop()`, { popisek: 'Odešlete — přijde odkaz na nové heslo (platí 15 minut)', po: 2500 });
      await n.drz(1500);
    },
  },
  {
    klic: 'obchod.adresy',
    oblast: 'store',
    celeOkno: true,
    pred: () => zakaznik('Marie', 'Horáková'),
    async hrat(n, ctx, z) {
      await prihlasitMimoZaber(n, ctx, z);
      await obchod(n, ctx, '/cz/account/addresses', { cekej: `document.body.textContent.includes('Nová adresa')` });
      await n.drz(1200);
      await n.klik(`[...document.querySelectorAll('button, a')].find(b => /Nová adresa/.test(b.textContent) && b.getClientRects().length)`, { popisek: 'Účet → Adresy → „Nová adresa"', po: 1500 });
      const vyplnit = async (nazev, hodnota, popisek) => {
        const sel = `[...document.querySelectorAll('input')].find(i => i.getClientRects().length && (i.name === ${JSON.stringify(nazev)} || i.name?.endsWith('.' + ${JSON.stringify(nazev)})))`;
        if (await n.ev(`!!(${sel})`)) await n.psat(sel, hodnota, { popisek });
      };
      await vyplnit('first_name', 'Marie', 'Vyplňte adresu');
      await vyplnit('last_name', 'Horáková');
      await vyplnit('address_1', 'Lipová 12');
      await vyplnit('city', 'Písek');
      await vyplnit('postal_code', '397 01');
      await vyplnit('phone', '777 123 456');
      await n.klik(`[...document.querySelectorAll('button[type=submit]')].filter(b => b.getClientRects().length).pop()`, { popisek: 'Uložte — v pokladně ji pak jen vyberete', po: 2500 });
    },
  },
  {
    klic: 'obchod.kurz',
    oblast: 'store',
    celeOkno: true,
    async hrat(n, ctx) {
      await obchod(n, ctx, '/cz/kurzy', { cekej: `[...document.querySelectorAll('a, button')].some(b => /Rezervovat/.test(b.textContent))` });
      const tlacitko = `[...document.querySelectorAll('a, button')].find(b => /Rezervovat/.test(b.textContent) && b.getClientRects().length)`;
      await n.ev(`(${tlacitko}).scrollIntoView({ block: 'center' })`);
      await n.pockej(2500);
      await n.popisek('Kurzy → u termínu „Rezervovat"');
      await n.drz(1500);
      await n.klik(tlacitko, { po: 2500 });
      await n.popisek('Počet osob (dospělí, děti), kontakt a způsob platby');
      await n.drz(2600);
    },
  },
];
