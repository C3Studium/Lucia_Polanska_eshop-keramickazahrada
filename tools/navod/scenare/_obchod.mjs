/* Pomůcky pro scénáře obchodu (oblast „store", izolovaný profil). */
import fs from 'node:fs';
import path from 'node:path';

const SANDBOX = path.resolve(import.meta.dirname, '../../../backend/sandbox');
export const stav = () => JSON.parse(fs.readFileSync(path.join(SANDBOX, '.run', 'seed-state.json'), 'utf8'));
const MAILY = 'http://127.0.0.1:54400';
const BACKEND = 'http://127.0.0.1:9100';

/** Otevře stránku obchodu; lištu cookies zavře mimo záběr. */
export const obchod = async (n, ctx, cesta, { cekej } = {}) => {
  await n.jdi(`${ctx.OBCHOD}${cesta}`, { pauza: 4000, cekej });
  await n.ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Odmítnout vše'); b?.click(); return 1; })()`);
  await n.pockej(900);
  await n.prekryv();
};

/** Store API se sandboxovým klíčem. */
export const store = async (p, body, { token, method } = {}) => {
  const r = await fetch(BACKEND + p, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', 'x-publishable-api-key': stav().publishable_key, ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`store ${p} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
};

/** Nejnovější odkaz z e-mailu pro adresáta (čte zachycené zprávy z backend/sandbox/.mail). */
export const odkazZMailu = async (komu, vzor, { cekat = 20000 } = {}) => {
  const dir = path.join(SANDBOX, '.mail');
  const konec = Date.now() + cekat;
  while (Date.now() < konec) {
    const seznam = await (await fetch(MAILY + '/api/list')).json();
    for (const m of seznam.filter((x) => (x.to ?? []).includes(komu)).reverse()) {
      let html = '';
      try { html = fs.readFileSync(path.join(dir, m.json.replace(/.json$/, '.html')), 'utf8'); } catch { /* ještě není */ }
      const hit = html.match(vzor);
      if (hit) return hit[0].replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('V e-mailech pro ' + komu + ' není odkaz ' + vzor);
};

/** Zákazník s účtem (registrace přes API). Vrací { email, heslo }. */
export const zakaznik = async (jmeno = 'Marie', prijmeni = 'Horáková') => {
  const email = `${jmeno.toLowerCase()}.${Date.now().toString(36)}@sandbox.test`;
  const heslo = 'Keramika-2026';
  const r = await fetch(BACKEND + '/auth/customer/emailpass/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: heslo }) });
  const { token } = await r.json();
  const { customer } = await store('/store/customers', { email, first_name: jmeno, last_name: prijmeni }, { token });
  /* Ověřený e-mail (jinak účet ukáže jen „potvrďte e-mail"). */
  const { api } = await import('../lib/api.mjs');
  await api(`/admin/customers/${customer.id}`, { metadata: { email_verified: true } });
  return { email, heslo, id: customer.id };
};

/** Přihlásí zákazníka v prohlížeči mimo záběr (bez snímků). */
export const prihlasitMimoZaber = async (n, ctx, { email, heslo }) => {
  await obchod(n, ctx, '/cz/account', { cekej: `document.querySelector('[data-testid="email-input"]')` });
  await n.ev(`(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }; set(document.querySelector('[data-testid="email-input"]'), ${JSON.stringify(email)}); set(document.querySelector('[data-testid="password-input"]'), ${JSON.stringify(heslo)}); document.querySelector('[data-testid="sign-in-button"]').click(); return 1; })()`);
  await n.cekej(`!document.querySelector('[data-testid="sign-in-button"]')`, 20000);
  await n.pockej(1500);
};
