import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { tl } from '../lib/rekorder.mjs';
import { novaObjednavka, odeslatADorucit } from './_spolecne.mjs';
import { obchod, odkazZMailu, prihlasitMimoZaber, zakaznik } from './_obchod.mjs';

/* Obchod — objednávka očima zákazníka: účet, úprava, reklamace, odstoupení.
   Odkazy jsou z e-mailů (jako je zákazník dostane), zachycených v sandboxu. */
const SANDBOX = path.resolve(import.meta.dirname, '../../../backend/sandbox');
const objednavka = async (api, { dorucit = false } = {}) => {
  const o = await novaObjednavka(api, { vyrobek: 'Keramické kytičky - různé barvy', platba: 'comgate' });
  if (dorucit) await odeslatADorucit(api, o.id);
  const { order } = await api(`/admin/orders/${o.id}?fields=email`);
  return { ...o, email: order.email };
};
const odkaz = (o, druh) => odkazZMailu(o.email, new RegExp(`http://localhost:8100/cz/order/${o.id}/${druh}\\?token=[^"'\\s<>]+`));
const naOdkaz = async (n, ctx, url, popisek) => {
  await obchod(n, ctx, url.replace('http://localhost:8100', ''), { cekej: `document.querySelector('main')` });
  await n.pockej(1500);
  await n.popisek(popisek);
  await n.drz(1800);
};

export default [
  {
    klic: 'obchod.objednavky',
    oblast: 'store',
    celeOkno: true,
    pred: async ({ api }) => {
      const z = await zakaznik('Eva', 'Dvořáková');
      const o = await objednavka(api);
      /* Objednávku přiřadit účtu (smoke-order nakupuje jako host). */
      execFileSync(process.execPath, ['db.mjs', 'sql', `update "order" set customer_id = '${z.id}' where id = '${o.id}'`], { cwd: SANDBOX, stdio: 'pipe' });
      return { z, o };
    },
    async hrat(n, ctx, { z }) {
      await prihlasitMimoZaber(n, ctx, z);
      await obchod(n, ctx, '/cz/account/orders', { cekej: `document.body.textContent.includes('#')` });
      await n.popisek('Účet → Objednávky: všechny vaše objednávky');
      await n.drz(1800);
      await n.klik(`[...document.querySelectorAll('a, button')].find(a => /Zobrazit objednávku|Detail/.test(a.textContent) && a.getClientRects().length)`, { popisek: 'Klik otevře detail — stav, položky, doprava', cekej: `location.pathname.includes('/details/')`, po: 2500 });
      await n.rolovat(`[...document.querySelectorAll('a, button')].find(a => /Upravit objednávku/.test(a.textContent))`).catch(() => undefined);
      await n.popisek('Odtud jde objednávku upravit, reklamovat nebo od ní odstoupit');
      await n.drz(2400);
    },
  },
  {
    klic: 'obchod.uprava',
    oblast: 'store',
    celeOkno: true,
    pred: async ({ api }) => {
      const o = await objednavka(api);
      return { o, url: await odkaz(o, 'edit') };
    },
    async hrat(n, ctx, { url }) {
      await naOdkaz(n, ctx, url, 'Odkaz „Upravit objednávku" je v potvrzovacím e-mailu');
      await n.klik(tl('Změnit adresu'), { popisek: 'Doručovací adresu změníte sami — dokud balík neodešel', po: 2200 });
      await n.klavesa('Escape', { po: 600 });
      await n.mys(tl('Potřebuji změnit objednávku'));
      await n.popisek('Jiné zboží nebo provedení? „Potřebuji změnit objednávku" — domluvíme se');
      await n.drz(2600);
    },
  },
  {
    klic: 'obchod.reklamace',
    oblast: 'store',
    celeOkno: true,
    pred: async ({ api }) => {
      const o = await objednavka(api, { dorucit: true });
      return { o, url: (await odkaz(o, 'refund')) + '&kind=reklamace' };
    },
    async hrat(n, ctx, { url }) {
      await naOdkaz(n, ctx, url, 'Reklamace: odkaz z e-mailu nebo tlačítko u objednávky');
      const volba = (text) => `[...document.querySelectorAll('main label, main button')].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)}) && e.getClientRects().length)`;
      await n.klik(volba('Reklamace'), { popisek: 'Co chcete řešit: Reklamace (vadný kus)', po: 900 });
      await n.klik(volba('Keramické kytičky'), { popisek: 'Zaškrtněte reklamovaný výrobek', po: 900 });
      await n.klik(volba('Vrácení peněz'), { popisek: 'Co požadujete: výměnu, nebo peníze zpět', po: 900 });
      await n.klik(volba('Vada'), { popisek: 'Co se stalo', po: 900 });
      const duvod = `[...document.querySelectorAll('main textarea')].find(t => t.getClientRects().length)`;
      if (await n.ev(`!!(${duvod})`)) await n.psat(duvod, 'Kytička přišla s ulomeným lístkem.', { popisek: 'Popište vadu a přiložte fotky' });
      await n.mys(`[...document.querySelectorAll('main button[type=submit]')].filter(b => b.getClientRects().length).pop()`).catch(() => undefined);
      await n.popisek('Odešlete — potvrzení a protokol přijdou e-mailem');
      await n.drz(2600);
    },
  },
  {
    klic: 'obchod.odstoupeni',
    oblast: 'store',
    celeOkno: true,
    pred: async ({ api }) => {
      const o = await objednavka(api, { dorucit: true });
      return { o, url: await odkaz(o, 'odstoupeni') };
    },
    async hrat(n, ctx, { url }) {
      await naOdkaz(n, ctx, url, 'Do 14 dnů od převzetí — odkaz „Odstoupit od smlouvy" z e-mailu');
      const box = `[...document.querySelectorAll('main input[type=checkbox], main button[role=checkbox]')].find(c => c.getClientRects().length)`;
      if (await n.ev(`!!(${box})`)) await n.klik(box, { popisek: 'Vyberte, co vracíte', po: 1200 });
      await n.mys(`[...document.querySelectorAll('main button[type=submit], main button')].filter(b => /Odstoupit|Odeslat/.test(b.textContent) && b.getClientRects().length).pop()`).catch(() => undefined);
      await n.popisek('Odešlete — přijde potvrzení a adresa, kam zboží poslat');
      await n.drz(2600);
    },
  },
];
