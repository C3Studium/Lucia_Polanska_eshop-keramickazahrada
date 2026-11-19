/**
 * Nahrávač GIFů návodu (19. 11. 2026).
 *
 * Řídí prohlížeč přes CDP (Edge/Chrome s --remote-debugging-port, výchozí
 * 9333) v SAMOSTATNÉM okně na pozadí — uživatelovy karty se nedotkne.
 * Snímky se nesbírají v reálném čase: každý krok (pohyb myši, klik, psaní)
 * vyrobí snímek s pevnou délkou, takže GIF má stejné tempo bez ohledu na
 * rychlost počítače. Myš je vložený kurzor (skutečný se na snímku nekreslí),
 * klik kreslí kroužek, krok má popisek dole.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = (() => {
  for (const p of [
    'sharp',
    path.resolve(import.meta.dirname, '../../../backend/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp'),
  ]) {
    try { return require(p); } catch { /* další */ }
  }
  throw new Error('Nenašel jsem sharp (backend/node_modules).');
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ——————————————————————— CDP ——————————————————————— */

export async function otevritProhlizec({ port = Number(process.env.NAVOD_CDP ?? 9333), width = 1440, height = 900, dark = false } = {}) {
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0;
  const waiters = new Map();
  const listeners = new Set();
  const chyby = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') chyby.push((m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text ?? '').slice(0, 300));
    for (const l of listeners) l(m);
  });
  const send = (method, params = {}, sessionId) => new Promise((res) => {
    const i = ++id;
    waiters.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    setTimeout(() => { if (waiters.has(i)) { waiters.delete(i); res({ error: { message: 'timeout ' + method } }); } }, 45000);
  });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank', background: true, newWindow: true });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  await S('Page.enable');
  await S('Runtime.enable');
  await S('Network.enable');
  await S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  return {
    S, chyby, width, height,
    onEvent: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    async zavrit() { await send('Target.closeTarget', { targetId }); ws.close(); },
  };
}

/* ——————————————— Překryv: kurzor, kroužek, popisek ——————————————— */

const PREKRYV = `(() => {
  if (window.__navod && document.getElementById('__navod-kurzor')) return true;
  const mk = (id, css, html) => { const el = document.createElement('div'); el.id = id; el.style.cssText = css; if (html) el.innerHTML = html; document.documentElement.appendChild(el); return el; };
  const z = 'position:fixed;pointer-events:none;z-index:2147483647;';
  const kurzor = mk('__navod-kurzor', z + 'left:0;top:0;width:28px;height:28px;transform:translate(-200px,-200px);',
    '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 2 L4 22 L9.5 17 L13 25.5 L16.6 24 L13.2 15.8 L20.5 15.8 Z" fill="#111" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>');
  const kruh = mk('__navod-kruh', z + 'left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid #f97316;opacity:0;box-sizing:border-box;');
  const popisek = mk('__navod-popisek', z + 'left:50%;bottom:18px;transform:translateX(-50%);max-width:min(820px,calc(100vw - 48px));display:none;align-items:center;gap:10px;padding:9px 16px 9px 9px;border-radius:12px;background:rgba(17,17,17,.9);color:#fff;font:600 15px/1.35 Inter,system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);');
  window.__navod = { kurzor, kruh, popisek, x: -200, y: -200 };
  return true;
})()`;

export class Nahravka {
  /**
   * @param {object} p prohlížeč z otevritProhlizec
   * @param {object} o { vyrez: {x,y,width,height} | null (celé okno), sirka: max šířka GIFu }
   */
  constructor(p, o = {}) {
    this.p = p;
    this.S = p.S;
    /* Bez levého menu adminu (240 px) — v okénku otazníku je záběr čitelnější. */
    this.vyrez = o.vyrez !== undefined ? o.vyrez : o.celeOkno ? null : { x: 240, y: 0, width: p.width - 240, height: p.height };
    this.sirka = o.sirka ?? 1100;
    this.snimky = [];
    this.krok = 0;
  }

  async ev(expr) {
    const r = await this.S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('ev: ' + (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text));
    return r.result?.result?.value;
  }

  async prekryv() { await this.ev(PREKRYV); }

  /** Výřez podle prvku (např. otevřený panel) — volat po otevření. */
  async vyrezPodle(cil, okraj = 0) {
    const r = await this.ev(`(() => { const el = (${cil}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })()`);
    if (!r) throw new Error('vyrezPodle: prvek nenalezen ' + cil);
    const x = Math.max(0, Math.floor(r.x - okraj)), y = Math.max(0, Math.floor(r.y - okraj));
    this.vyrez = { x, y, width: Math.min(this.p.width - x, Math.ceil(r.width + 2 * okraj)), height: Math.min(this.p.height - y, Math.ceil(r.height + 2 * okraj)) };
    await this.umistitPopisek();
  }

  async umistitPopisek() {
    const v = this.vyrez ?? { x: 0, y: 0, width: this.p.width, height: this.p.height };
    await this.ev(`(() => { const p = window.__navod?.popisek; if (!p) return; p.style.left = '${v.x + v.width / 2}px'; p.style.bottom = '${this.p.height - (v.y + v.height) + 16}px'; p.style.maxWidth = '${Math.max(240, v.width - 40)}px'; })()`);
  }

  /** Jeden snímek s danou délkou (ms). */
  async snimek(delay = 80) {
    await this.prekryv();
    const v = this.vyrez ?? { x: 0, y: 0, width: this.p.width, height: this.p.height };
    const r = await this.S('Page.captureScreenshot', { format: 'png', clip: { ...v, scale: 1 }, captureBeyondViewport: false });
    if (!r.result?.data) throw new Error('snímek selhal: ' + JSON.stringify(r.error ?? {}));
    this.snimky.push({ buf: Buffer.from(r.result.data, 'base64'), delay });
  }

  async drz(ms = 1200) { await this.snimek(ms); }

  async jdi(url, { cekej = null, pauza = 1500 } = {}) {
    await this.S('Page.navigate', { url });
    await sleep(pauza);
    if (cekej) await this.cekej(cekej);
    await this.prekryv();
    await this.umistitPopisek();
    await this.ev(`(() => { const n = window.__navod; n.kurzor.style.transform = 'translate(' + n.x + 'px,' + n.y + 'px)'; })()`);
  }

  /** Počká, až výraz vrátí pravdivou hodnotu. */
  async cekej(expr, timeout = 25000) {
    const konec = Date.now() + timeout;
    while (Date.now() < konec) {
      try { if (await this.ev(`(() => { try { return !!(${expr}); } catch { return false; } })()`)) return; } catch { /* stránka se načítá */ }
      await sleep(250);
    }
    throw new Error('cekej: nedočkal jsem se ' + expr.slice(0, 120));
  }

  async stred(cil) {
    /* Položka rozbalovacího seznamu/nabídky: odrolovat jen uvnitř seznamu. */
    const vSeznamu = await this.ev(`(() => { const el = (${cil}); if (!el || !el.closest('[role=listbox],[role=menu],[data-radix-popper-content-wrapper]')) return false; el.scrollIntoView({ block: 'nearest' }); return true; })()`);
    if (vSeznamu) await this.snimek(250);
    const mimo = await this.ev(`(() => { const el = (${cil}); if (!el) return null; const r = el.getBoundingClientRect(); return r.top < 70 || r.bottom > innerHeight - 90; })()`);
    if (mimo === null) throw new Error('prvek nenalezen: ' + cil.slice(0, 60) + ' … ' + cil.slice(-140));
    if (mimo) await this.rolovat(cil);
    const p = await this.ev(`(() => { const el = (${cil}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + Math.min(r.width / 2, 60), y: r.y + r.height / 2 }; })()`);
    if (!p) throw new Error('prvek nenalezen: ' + cil.slice(0, 60) + ' … ' + cil.slice(-140));
    return p;
  }

  async popisek(text) {
    if (text) this.krok += 1;
    await this.prekryv();
    await this.umistitPopisek();
    await this.ev(`(() => { const p = window.__navod.popisek; if (!${JSON.stringify(text)}) { p.style.display = 'none'; return; } p.style.display = 'flex'; p.innerHTML = '<span style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#f97316;color:#fff;font-size:13px">${this.krok}</span><span></span>'; p.lastChild.textContent = ${JSON.stringify(text)}; })()`);
  }

  /** Plynulý pohyb myši na prvek. */
  async mys(cil, { kroky = 9, delay = 45 } = {}) {
    const { x, y } = await this.stred(cil);
    const start = await this.ev(`({ x: window.__navod.x, y: window.__navod.y })`);
    const sx = start.x < 0 ? x - 160 : start.x, sy = start.y < 0 ? y + 90 : start.y;
    for (let i = 1; i <= kroky; i++) {
      const t = i / kroky, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const cx = sx + (x - sx) * e, cy = sy + (y - sy) * e;
      await this.ev(`(() => { const n = window.__navod; n.x = ${cx}; n.y = ${cy}; n.kurzor.style.transform = 'translate(${cx}px,${cy}px)'; })()`);
      await this.S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
      await this.snimek(delay);
    }
    return { x, y };
  }

  /** Klik s kroužkem. `po` = jak dlouho držet výsledek. */
  async klik(cil, { popisek, po = 700, cekej = null } = {}) {
    if (popisek !== undefined) await this.popisek(popisek);
    const { x, y } = await this.mys(cil);
    await this.snimek(250);
    await this.ev(`(() => { const k = window.__navod.kruh; k.style.left = '${x}px'; k.style.top = '${y}px'; k.style.opacity = '1'; k.style.transform = 'scale(.6)'; })()`);
    await this.snimek(90);
    await this.S('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.S('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await this.ev(`(() => { const k = window.__navod.kruh; k.style.transform = 'scale(1.1)'; k.style.opacity = '.55'; })()`);
    await sleep(120);
    await this.snimek(90);
    await this.ev(`(() => { const k = window.__navod.kruh; k.style.opacity = '0'; })()`);
    if (cekej) await this.cekej(cekej);
    else await sleep(450);
    await this.prekryv();
    await this.snimek(po);
  }

  /** Napíše text do pole (klikne do něj, pak po kouskách). */
  async psat(cil, text, { popisek, smazat = true, po = 600 } = {}) {
    await this.klik(cil, { popisek, po: 150 });
    if (smazat) {
      await this.ev(`(() => { const el = document.activeElement; if (el && 'select' in el) el.select(); })()`);
      await this.S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
      await this.S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    }
    const kus = text.length > 24 ? 4 : 2;
    for (let i = 0; i < text.length; i += kus) {
      await this.S('Input.insertText', { text: text.slice(i, i + kus) });
      await this.snimek(70);
    }
    await sleep(250);
    await this.snimek(po);
  }

  async klavesa(key, { po = 500 } = {}) {
    const codes = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38 };
    await this.S('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: codes[key] ?? 0, text: key === 'Enter' ? '\r' : undefined });
    await this.S('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: codes[key] ?? 0 });
    await sleep(400);
    await this.snimek(po);
  }

  /** Plynule odroluje prvek do středu (posuvník stránky nebo panelu). */
  async rolovat(cil, { kroky = 6 } = {}) {
    for (let i = 0; i < kroky; i++) {
      const hotovo = await this.ev(`(() => { const el = (${cil}); if (!el) return true; const r = el.getBoundingClientRect(); const d = r.top + r.height / 2 - innerHeight / 2; if (Math.abs(d) < 30) return true; let s = el.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement; (s ?? document.scrollingElement).scrollBy(0, Math.sign(d) * Math.min(Math.abs(d), Math.max(80, Math.abs(d) / ${kroky - i}))); return false; })()`);
      await sleep(60);
      await this.snimek(60);
      if (hotovo) break;
    }
    await this.snimek(300);
  }

  /** Uloží GIF. Vrací { soubor, width, height, bytes, snimku }. */
  async ulozit(soubor, { konec = 2200 } = {}) {
    await this.popisek(null).catch(() => undefined);
    if (this.snimky.length) this.snimky[this.snimky.length - 1].delay += konec;
    // stejné po sobě jdoucí snímky sloučit (jen delší pauza)
    const sloucene = [];
    for (const s of this.snimky) {
      const last = sloucene[sloucene.length - 1];
      if (last && last.buf.equals(s.buf)) last.delay += s.delay;
      else sloucene.push({ ...s });
    }
    const meta = await sharp(sloucene[0].buf).metadata();
    const sirka = Math.min(this.sirka, meta.width);
    const ramce = await Promise.all(sloucene.map((s) => sharp(s.buf).resize({ width: sirka }).png().toBuffer()));
    const out = await sharp(ramce, { join: { animated: true } })
      .gif({ delay: sloucene.map((s) => Math.max(20, Math.round(s.delay))), loop: 0, effort: 8, colours: 160, dither: 0, interFrameMaxError: 4, interPaletteMaxError: 4 })
      .toBuffer();
    fs.mkdirSync(path.dirname(soubor), { recursive: true });
    fs.writeFileSync(soubor, out);
    const m = await sharp(out, { animated: true }).metadata();
    return { soubor, width: m.width, height: m.pageHeight ?? m.height, bytes: out.length, snimku: sloucene.length };
  }
}

/* ——————————————— Hledání prvků (výrazy do stránky) ——————————————— */

const q = (s) => JSON.stringify(s);
/** Tlačítko nebo odkaz podle textu (začátek, bez ✓). */
export const tl = (text, scope = 'document') =>
  `(() => { const all = [...(${scope}).querySelectorAll('button, a, [role=button], [role=tab], [role=menuitem], [role=menuitemradio], [role=option], label, summary')].filter(b => b.getClientRects().length); const t = (b) => b.textContent.replace(/\\s+/g, ' ').trim().replace(/^✓ /, ''); return all.find(b => t(b) === ${q(text)}) ?? all.find(b => t(b).startsWith(${q(text)})) ?? all.find(b => t(b).includes(${q(text)})); })()`;
/** Libovolný viditelný prvek s přesným textem (nejhlubší). */
export const txt = (text, scope = 'document') =>
  `[...(${scope}).querySelectorAll('body *')].filter(e => e.children.length === 0 && e.textContent.trim() === ${q(text)} && e.getClientRects().length)[0]`;
/** Prvek obsahující text (nejhlubší). */
export const obs = (text, scope = 'document') =>
  `[...(${scope}).querySelectorAll('body *')].filter(e => e.textContent.includes(${q(text)}) && e.getClientRects().length && ![...e.children].some(c => c.textContent.includes(${q(text)})))[0]`;
export const css = (sel, scope = 'document') => `(${scope}).querySelector(${q(sel)})`;
export const dialog = `[...document.querySelectorAll('[role=dialog],[role=alertdialog]')].filter(d => d.getClientRects().length).pop()`;
export const pole = (label, scope = 'document') =>
  `(() => { const l = [...(${scope}).querySelectorAll('label')].find(l => l.textContent.trim().startsWith(${q(label)})); if (l?.htmlFor) return document.getElementById(l.htmlFor); return l?.querySelector('input,textarea,select') ?? (${scope}).querySelector('[placeholder^=' + JSON.stringify(${q(label)}) + ']'); })()`;
/** Přepínač podle textu popisku (InspectorSwitchRow: label htmlFor → switch). */
export const prepinac = (label, scope = 'document') =>
  `(() => { const l = [...(${scope}).querySelectorAll('label')].find(l => l.textContent.replace(/\\s+/g, ' ').trim() === ${q(label)}); return l ? (l.htmlFor ? document.getElementById(l.htmlFor) : l.querySelector('button,[role=switch]')) : null; })()`;
/** Prvek podle aria-label (začátek). */
export const aria = (label, scope = 'document') =>
  `[...(${scope}).querySelectorAll('[aria-label]')].filter(e => e.getClientRects().length).find(e => e.getAttribute('aria-label').startsWith(${q(label)}))`;
