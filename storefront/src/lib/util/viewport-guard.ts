/**
 * Hlídač okna na telefonech — hlavně iPhone a starší Safari (19. 11. 2026).
 *
 * Vložený skript v `app/layout.tsx`, ne komponenta: běží hned při načtení,
 * ještě před hydratací, takže první ťuknutí do pole už má správný viewport.
 * Psaný jako ES2017 bez `?.` a `??` — Safari 12/13 je nezná.
 *
 * Co dělá a proč (zdroje: WebKit bug 191204, 190771; Apple Developer Forums
 * 685481, 716552, 800125; dev.to „bottom tab bars on Safari iOS 15"):
 *
 * 1. iOS: `maximum-scale=1` do viewportu. Pole mají na telefonu písmo
 *    12,8 px (měřítko 0,8) a iOS při zaostření pole pod 16 px celou stránku
 *    PŘIBLÍŽÍ. Pevné vrstvy (hledání, lišta) pak nesedí s místem, kam prst
 *    klepe — „s otevřenou klávesnicí nic nefunguje". Od iOS 10 maximum-scale
 *    brání jen tomuhle automatickému přiblížení, roztažení prsty dál jde.
 *    Na Androidu se nepřidává (tam by roztažení zakázalo).
 *
 * 2. Proměnné na :root:
 *    --kz-vh     1 % skutečné výšky okna (záloha za dvh/svh pro Safari < 15.4,
 *                viz postcss-stare-safari.js),
 *    --kz-vvh    výška VIDITELNÉ části (bez klávesnice),
 *    --kz-ios-bottom  o kolik zvednout spodní lištu, když Safari sbalí svou
 *                spodní lištu. Sbalená adresa (iOS 15+) i oblast domovského
 *                pruhu (iOS 12–14, minimal UI) leží PŘES spodní okraj stránky
 *                a ťuknutí tam si vezme Safari (rozbalí lištu) — naše lišta
 *                byla schovaná a nešla zmáčknout. `env(safe-area-inset-bottom)`
 *                je při sbalené liště 0 (fórum 716552), proto počet z výšky.
 *
 * 3. Třída `kz-klavesnice` na <html>, dokud je otevřená klávesnice — spodní
 *    lišta a pruh „K pokladně" se schovají (globals.scss).
 *
 * 4. Ťuknutí mimo pole zavře klávesnici (blur). Na prázdné místo hned; na
 *    odkaz/tlačítko až po jeho kliknutí, aby se klik nepřesunul, když se
 *    stránka po zavření klávesnice pohne.
 *
 * Při změně zvednutí lišty pošle událost `kz:viewport` (MobileBar podle ní
 * přepočítá `--nav-bottom-clearance`).
 */
export const VIEWPORT_GUARD_JS = `(function () {
  try {
    var d = document, w = window, root = d.documentElement;
    var ua = navigator.userAgent || '';
    var iPhone = /iPhone|iPod/.test(ua);
    var iOS = iPhone || /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = navigator.standalone === true || (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches);
    /* Znovu při každé aktualizaci: Next může hlavičku při přechodu přerenderovat. */
    var ensureMeta = function () {
      if (!iOS) return;
      var meta = d.querySelector('meta[name="viewport"]');
      if (!meta) { meta = d.createElement('meta'); meta.name = 'viewport'; d.head.appendChild(meta); }
      var c = meta.getAttribute('content') || 'width=device-width, initial-scale=1';
      if (!/maximum-scale/.test(c)) meta.setAttribute('content', c + ', maximum-scale=1');
    };
    ensureMeta();
    /* Hlavičku i <html> může React při hydrataci přepsat (naměřeno: meta bez
       maximum-scale, proměnné pryč) — hlídat a vracet. */
    if (iOS && w.MutationObserver && d.head) {
      new MutationObserver(ensureMeta).observe(d.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content'] });
    }
    var vv = w.visualViewport;
    var minH = Infinity, maxH = 0, lastOrient = null, lastPad = -1, frame = 0;
    var isText = function (el) {
      if (!el || !el.tagName) return false;
      if (el.isContentEditable) return true;
      if (el.tagName === 'TEXTAREA') return true;
      if (el.tagName !== 'INPUT') return false;
      return !/^(button|submit|reset|checkbox|radio|range|file|color|image|hidden)$/i.test(el.type || '');
    };
    /*
     * Kdo zvedání potřebuje (21. 11. 2026) — JEN aplikace Safari na iPhonu
     * před verzí 26:
     *  - Safari 26+ (plovoucí ovládání) pevný obsah pod svou lištu vůbec
     *    nevykreslí, takže zvedat není co — a jeho lišta se animuje ~30
     *    snímků a v každém mění innerHeight (AGENTS.md).
     *  - Ostatní prohlížeče na iPhonu (Chrome, Firefox, Edge, Seznam, Opera,
     *    vestavěné prohlížeče aplikací) mají vlastní lišty a ťuknutí u spodní
     *    hrany si neberou. Dřív se zvedaly omylem: nemají v UA „Version/",
     *    verze vyšla 0 = „starý Safari" — i na iOS 26. Tam lišta poskakovala
     *    při každém posunu (Matěj: „these issues are in Seznam Browser").
     *  - Android (i Seznam) nezvedá nikdy, lišta jede s oknem sama.
     */
    var thirdParty = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\\/|SznProhlizec|Seznam|YaBrowser|DuckDuckGo|GSA\\/|FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|Twitter|Pinterest|Line\\//.test(ua);
    var safariMajor = (function () { var m = /Version\\/(\\d+)/.exec(ua); return m ? +m[1] : 0; })();
    var realSafari = iPhone && !thirdParty && safariMajor > 0 && /Safari\\//.test(ua);
    var liftable = realSafari && !standalone && safariMajor < 26;
    if (liftable) root.classList.add('kz-zvedani');
    var lastWidth = -1, settleTimer = 0, keyboard = false;
    var computePad = function () {
      settleTimer = 0;
      var ih = w.innerHeight, portrait = ih >= w.innerWidth;
      var pad = 0;
      if (liftable && portrait && !keyboard) {
        var sw = Math.min(screen.width, screen.height), sh = Math.max(screen.width, screen.height);
        var collapsed = (sh - ih) < 90 || (minH < Infinity && ih > minH + 40);
        if (collapsed) pad = sh / sw > 2 ? 46 : 32;
        /*
         * Rovnováha (21. 11. 2026): Safari svou lištu rozbalí při každém
         * posunu nahoru a sbalí při posunu dolů — lišta, která to kopírovala,
         * skákala o 32–46 px sem a tam. Zvednutá proto ZŮSTANE i po rozbalení
         * a pustí se až nahoře na stránce (do 40 px), kde Safari lištu
         * ukazuje vždy. Za návštěvu stránky tak nejvýš jeden pohyb nahoru
         * a jeden dolů; ťuknutí jdou pořád na naši lištu.
         */
        else if (lastPad > 0 && (w.pageYOffset || root.scrollTop || 0) > 40) pad = lastPad;
      }
      if (root.style.getPropertyValue('--kz-ios-bottom') !== pad + 'px') root.style.setProperty('--kz-ios-bottom', pad + 'px');
      if (pad !== lastPad) {
        lastPad = pad;
        try { w.dispatchEvent(new Event('kz:viewport')); } catch (e) {}
      }
    };
    var update = function () {
      frame = 0;
      ensureMeta();
      if (iOS) root.classList.add('kz-ios');
      if (liftable) root.classList.add('kz-zvedani');
      var ih = w.innerHeight, iw = w.innerWidth;
      var portrait = ih >= iw;
      if (portrait !== lastOrient) { lastOrient = portrait; minH = Infinity; maxH = 0; }
      var focused = isText(d.activeElement);
      if (!focused) { if (ih < minH) minH = ih; if (ih > maxH) maxH = ih; }
      var vh = vv ? vv.height : ih;
      /* --kz-vh (záloha za svh/dvh na Safari < 15.4) jen při změně šířky
         nebo otočení — ne při každém pohybu lišty prohlížeče, jinak by se
         výšky panelů měnily pod prstem během scrollu. */
      if (iw !== lastWidth || !root.style.getPropertyValue('--kz-vh')) {
        lastWidth = iw;
        root.style.setProperty('--kz-vh', (ih / 100) + 'px');
      }
      /* --kz-vvh čte jen hledání s otevřenou klávesnicí. Psát ho při každém
         snímku posunu (lišta Safari mění výšku ~30 snímků po sobě) nutilo
         prohlížeč přepočítat styl CELÉ stránky v každém z nich — sekání na
         začátku posunu na starších telefonech (21. 11. 2026). Proto jen při
         poli s fokusem / otevřené klávesnici, a jen když se hodnota změní. */
      var vvh = Math.round(vh) + 'px';
      if ((focused || keyboard || !root.style.getPropertyValue('--kz-vvh')) && root.style.getPropertyValue('--kz-vvh') !== vvh) {
        root.style.setProperty('--kz-vvh', vvh);
      }
      keyboard = !!(focused && (vh < ih - 120 || (maxH > 0 && ih < maxH - 150)));
      root.classList.toggle('kz-klavesnice', keyboard);
      /* Zvednutí až po ustálení (300 ms bez změny) — za animace lišty
         Safari by lišta poskakovala snímek po snímku. */
      if (lastPad < 0) computePad();
      else { if (settleTimer) clearTimeout(settleTimer); settleTimer = setTimeout(computePad, 300); }
      if (!root.style.getPropertyValue('--kz-ios-bottom')) root.style.setProperty('--kz-ios-bottom', Math.max(lastPad, 0) + 'px');
    };
    var schedule = function () {
      if (frame) return;
      frame = w.requestAnimationFrame ? w.requestAnimationFrame(update) : setTimeout(update, 16);
    };
    update();
    /* Po hydrataci znovu — React mohl styl i třídy na <html> smazat. */
    w.addEventListener('load', schedule);
    [300, 1200, 3000, 6000].forEach(function (t) { setTimeout(update, t); });
    w.addEventListener('resize', schedule);
    w.addEventListener('orientationchange', function () { setTimeout(update, 250); });
    w.addEventListener('scroll', schedule, { passive: true });
    w.addEventListener('pageshow', schedule);
    d.addEventListener('focusin', function () { ensureMeta(); schedule(); }, true);
    d.addEventListener('focusout', function () { setTimeout(update, 60); });
    if (vv) { vv.addEventListener('resize', schedule); vv.addEventListener('scroll', schedule); }

    if (/^\\/studio/.test(location.pathname)) return;
    var blurAfterClick = null;
    var interactive = 'a,button,select,label,summary,[role="button"],[role="link"],[role="option"]';
    d.addEventListener('touchstart', function (e) {
      var a = d.activeElement;
      if (!isText(a)) return;
      var t = e.target;
      if (t && t.nodeType !== 1) t = t.parentElement;
      if (!t || t === a || (a.contains && a.contains(t)) || isText(t)) return;
      if (t.closest && t.closest('[data-kz-necha-klavesnici]')) return;
      if (t.closest && t.closest(interactive)) { blurAfterClick = a; return; }
      a.blur();
    }, { passive: true, capture: true });
    var afterClick = function () {
      var el = blurAfterClick;
      if (!el) return;
      blurAfterClick = null;
      setTimeout(function () { if (d.activeElement === el) el.blur(); }, 0);
    };
    d.addEventListener('click', afterClick, true);
    d.addEventListener('touchend', function () { setTimeout(afterClick, 400); }, { passive: true, capture: true });
  } catch (e) {}
})();`

/**
 * Doplňky funkcí pro starší prohlížeče (20. 11. 2026) — jen to, co web
 * opravdu používá a co Next.js nepřeloží (překládá zápis, ne funkce).
 * Sken produkčních souborů a zdroje našel `.at(-1)` (Next.js při přesměrování
 * a naše `shipping_methods.at(-1)`): Safari < 15.4 tam spadne s TypeError.
 * Na novém prohlížeči se nic nedefinuje — funkce už existuje.
 */
export const POLYFILLS_JS = `(function () {
  try {
    var at = function (n) {
      n = Math.trunc ? Math.trunc(n) || 0 : (n < 0 ? Math.ceil(n) : Math.floor(n)) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
    [Array.prototype, String.prototype].forEach(function (proto) {
      if (!proto.at) Object.defineProperty(proto, 'at', { value: at, writable: true, configurable: true });
    });
    if (typeof Int8Array !== 'undefined') {
      var Typed = Object.getPrototypeOf(Int8Array.prototype);
      if (Typed && !Typed.at) Object.defineProperty(Typed, 'at', { value: at, writable: true, configurable: true });
    }
    /* matchMedia(...).addEventListener('change') — Safari < 14 zná jen
       addListener a jinak spadne (9 míst v kódu, i globální háky). */
    var MQL = window.MediaQueryList;
    if (MQL && MQL.prototype && !MQL.prototype.addEventListener && MQL.prototype.addListener) {
      MQL.prototype.addEventListener = function (type, fn) { if (type === 'change') this.addListener(fn); };
      MQL.prototype.removeEventListener = function (type, fn) { if (type === 'change') this.removeListener(fn); };
    }
  } catch (e) {}
})();`
