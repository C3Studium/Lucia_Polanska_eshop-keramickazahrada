/* KOPIE storefront/src/lib/util/reload-keeper.ts — držet obě stejné (18. 11. 2026).
   Vkládá se do index.html adminu (medusa-config.js, vite transformIndexHtml). */
export const RELOAD_KEEPER_JS = `(function () {
  if (window.__kzReloadKeeper) return;
  var KEY = 'kz-reload-drafts';
  var last = Date.now();
  ['keydown', 'input', 'pointerdown', 'wheel', 'touchstart'].forEach(function (t) {
    window.addEventListener(t, function () { last = Date.now(); }, { capture: true, passive: true });
  });
  function skip(el) {
    var t = String(el.type || '').toLowerCase();
    if (t === 'password' || t === 'file' || t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset' || t === 'image') return true;
    var ac = String(el.getAttribute('autocomplete') || '').toLowerCase();
    if (ac.indexOf('cc-') === 0 || ac.indexOf('one-time-code') >= 0 || ac.indexOf('password') >= 0) return true;
    return false;
  }
  function fields() {
    return Array.prototype.slice.call(document.querySelectorAll('input, textarea, select')).filter(function (el) { return !skip(el); });
  }
  function keyOf(el, counts) {
    var base = [el.tagName, el.type || '', el.name || el.id || el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''].join('|');
    counts[base] = (counts[base] || 0) + 1;
    return base + '#' + counts[base];
  }
  function save() {
    try {
      var counts = {}, out = [];
      fields().forEach(function (el) {
        var k = keyOf(el, counts), t = String(el.type || '').toLowerCase();
        if (t === 'checkbox' || t === 'radio') out.push({ k: k, c: !!el.checked });
        else if (el.value !== '') out.push({ k: k, v: el.value });
      });
      sessionStorage.setItem(KEY, JSON.stringify({ p: location.pathname + location.search, at: Date.now(), f: out, y: window.scrollY }));
    } catch (e) {}
  }
  function setValue(el, value) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function restore() {
    var raw = null, data = null;
    try { raw = sessionStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    try { data = JSON.parse(raw); } catch (e) {}
    if (!data || data.p !== location.pathname + location.search || Date.now() - data.at > 120000) {
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      return;
    }
    var pending = {}, left = 0;
    (data.f || []).forEach(function (x) { pending[x.k] = x; left += 1; });
    var observer = null, done = false, scrolled = false;
    function stop() {
      if (done) return;
      done = true;
      if (observer) observer.disconnect();
      try { sessionStorage.removeItem(KEY); } catch (e) {}
    }
    function apply() {
      if (done) return;
      if (!scrolled && typeof data.y === 'number' && document.body && document.body.scrollHeight > data.y) {
        scrolled = true;
        window.scrollTo(0, data.y);
      }
      var counts = {};
      fields().forEach(function (el) {
        var k = keyOf(el, counts), x = pending[k];
        if (!x) return;
        var t = String(el.type || '').toLowerCase();
        if (t === 'checkbox' || t === 'radio') { if (!!el.checked !== x.c) el.click(); }
        else if (el.value !== x.v) setValue(el, x.v);
        delete pending[k];
        left -= 1;
      });
      if (left <= 0) stop();
    }
    function start() {
      apply();
      if (done) return;
      observer = new MutationObserver(function () { apply(); });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(stop, 15000);
    }
    // Až po hydrataci Reactu, jinak by vrácené hodnoty přepsal.
    if (document.readyState === 'complete') setTimeout(start, 400);
    else window.addEventListener('load', function () { setTimeout(start, 400); });
  }
  var waiting = false;
  window.__kzReloadKeeper = {
    /* Uloží hned a obnoví skoro hned (2. kolo 18. 11.: „čekat na klid ne,
       člověk se dívá i přes 10 s"). Počká jen, dokud zrovna mačká klávesu
       (idleMs, výchozí 400 ms) — nejvýš maxMs, pak obnoví tak jako tak. */
    reload: function (idleMs, maxMs) {
      if (waiting) return;
      waiting = true;
      save();
      var need = typeof idleMs === 'number' ? idleMs : 400;
      var deadline = Date.now() + (typeof maxMs === 'number' ? maxMs : 3000);
      var timer = setInterval(function () {
        if (!document.hidden && Date.now() - last < need && Date.now() < deadline) return;
        clearInterval(timer);
        save();
        location.reload();
      }, 100);
    },
    save: save,
  };
  restore();
})();`
