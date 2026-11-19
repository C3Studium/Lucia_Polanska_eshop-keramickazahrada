/**
 * Šipky Zpět / Vpřed vlevo nahoře v adminu (19. 11. 2026, Matěj: „chybí
 * krok zpět a krok vpřed").
 *
 * Medusa horní lištu upravit nedovoluje (widgety do ní nejdou), proto je to
 * vložený skript do `index.html` adminu (`medusa-config.js`, stejně jako
 * strážce rozepsaných polí). Hledá lištu podle její stálé třídy
 * (`grid grid-cols-2 border-b` → `flex items-center`) a za tlačítko
 * postranního panelu vloží dvě tlačítka; vzhled převezme z něj, takže sedí
 * i do tmavého režimu. React lištu při navigaci překresluje — MutationObserver
 * je vrátí, kdyby zmizely.
 *
 * Zpět / Vpřed = historie prohlížeče (React Router jede přes ni), takže se
 * vrací i filtry a záložky v adrese. Šedivé stavy z Navigation API (Edge,
 * Chrome); kde chybí (Safari), jsou tlačítka vždy aktivní. Klávesy Alt+←/→
 * umí prohlížeč sám.
 */
export const ADMIN_NAV_JS = `(function () {
  if (window.__kzAdminNav) return;
  window.__kzAdminNav = true;
  var ID = 'kz-admin-nav';
  var nav = window.navigation;
  var ICON = {
    back: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M9 3L5 7.5L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fwd: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M6 3L10 7.5L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function refresh() {
    var box = document.getElementById(ID);
    if (!box || !nav) return;
    var b = box.querySelector('[data-kz=back]'), f = box.querySelector('[data-kz=fwd]');
    if (b) b.disabled = !nav.canGoBack;
    if (f) f.disabled = !nav.canGoForward;
  }
  function make(kind, label, toggle) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-kz', kind);
    btn.setAttribute('aria-label', label);
    btn.title = label + (kind === 'back' ? ' (Alt+←)' : ' (Alt+→)');
    btn.className = toggle ? toggle.className : '';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.width = '28px';
    btn.style.height = '28px';
    btn.innerHTML = ICON[kind];
    btn.addEventListener('click', function () {
      if (kind === 'back') history.back(); else history.forward();
    });
    return btn;
  }
  function mount() {
    if (document.getElementById(ID)) return;
    var bar = document.querySelector('div.grid.grid-cols-2.border-b');
    if (!bar) return;
    var row = bar.querySelector(':scope > div.flex.items-center');
    if (!row || !row.firstElementChild) return;
    var toggle = row.firstElementChild.querySelector('button');
    var box = document.createElement('div');
    box.id = ID;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Historie');
    box.style.display = 'inline-flex';
    box.style.alignItems = 'center';
    box.style.gap = '2px';
    box.appendChild(make('back', 'Zpět', toggle));
    box.appendChild(make('fwd', 'Vpřed', toggle));
    row.insertBefore(box, row.firstElementChild.nextSibling);
    refresh();
  }
  if (nav && nav.addEventListener) nav.addEventListener('currententrychange', function () { setTimeout(refresh, 0); });
  window.addEventListener('popstate', function () { setTimeout(refresh, 0); });
  function start() {
    mount();
    new MutationObserver(function () { mount(); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();`
