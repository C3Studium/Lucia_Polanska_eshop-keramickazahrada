import { aria, css, obs, tl } from '../lib/rekorder.mjs';
import { PITKO, vyrobek } from './_spolecne.mjs';

/* Začínáme — orientace v adminu (celé okno včetně menu). */
export default [
  {
    klic: 'zacatek.prehled',
    oblast: 'admin',
    celeOkno: true,
    async hrat(n, ctx) {
      await ctx.admin(n);
      await n.jdi(`${ctx.ADMIN}/app/prehled`, { cekej: `document.body.textContent.includes('Čeká na vás')`, pauza: 3000 });
      await n.popisek('Přehled — první stránka po přihlášení');
      await n.drz(1500);
      await n.mys(obs('Čeká na vás'));
      await n.popisek('„Čeká na vás" — co je potřeba vyřídit; klik vás tam rovnou vezme');
      await n.drz(2000);
      await n.mys(obs('Jak se obchodu daří'));
      await n.popisek('Níž tržby a objednávky za 7 dní, měsíc, 3 měsíce nebo rok');
      await n.drz(1800);
      await n.klik(`[...document.querySelectorAll('a, button')].find(b => /reklamace nebo vrácení/.test(b.textContent))`, { popisek: 'Klik na kartičku otevře, co čeká', po: 2000 });
    },
  },
  {
    klic: 'zacatek.orientace',
    oblast: 'admin',
    celeOkno: true,
    async hrat(n, ctx) {
      await ctx.admin(n);
      await n.jdi(`${ctx.ADMIN}/app/prehled`, { cekej: `document.body.textContent.includes('Čeká na vás')`, pauza: 3000 });
      await n.klik(tl('Produkty'), { popisek: 'Vlevo menu — klikněte, kam chcete', cekej: `location.pathname.includes('produkty')`, po: 1500 });
      await n.klik(`[...document.querySelectorAll('a, [role=link]')].find(a => a.textContent.includes(${JSON.stringify(PITKO)}))`, { popisek: 'Klik na výrobek otevře detail', cekej: `location.pathname.includes('/produkt/')`, po: 1800 });
      await n.klik(aria('Zpět'), { popisek: 'Šipkou nahoře vlevo se vrátíte zpět (Vpřed vedle ní)', po: 1800 });
      await n.klik(tl('Hledat'), { popisek: '„Hledat" (nebo Ctrl+K) najde cokoli — výrobek, objednávku, zákazníka', po: 1000 });
      await n.S('Input.insertText', { text: 'kytka' });
      await n.pockej(1500);
      await n.snimek(1800);
      await n.klavesa('Escape', { po: 800 });
    },
  },
  {
    klic: 'zacatek.navod',
    oblast: 'admin',
    celeOkno: true,
    async hrat(n, ctx) {
      await ctx.admin(n);
      const id = await vyrobek(ctx.api, PITKO);
      await n.jdi(`${ctx.ADMIN}/app/produkt/${id}`, { cekej: `document.getElementById('produkt-zarazeni')`, pauza: 3000 });
      await n.popisek('Nevíte si rady? Najeďte myší na otazník');
      await n.mys(aria('Návod: Sleva na výrobek'));
      await n.pockej(900);
      await n.drz(2600);
      await n.klik(tl('Celý návod s kroky'), { popisek: '„Celý návod s kroky" — všechny návody pohromadě', cekej: `location.pathname.includes('navod')`, po: 1800 });
      await n.psat(css('input[type=search]'), 'štítek', { popisek: 'Návod jde i prohledat' });
      await n.drz(2000);
    },
  },
];
