/** Admin API cíle (sandbox, nebo s CIL/EMAIL/HESLO jiný backend). */
export const CIL = process.env.CIL ?? 'http://127.0.0.1:9100';

let token = null;
export const prihlasit = async (email = process.env.EMAIL ?? 'admin@sandbox.test', heslo = process.env.HESLO ?? 'sandbox-admin-123') => {
  const r = await fetch(CIL + '/auth/user/emailpass', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: heslo }),
  });
  const j = await r.json();
  if (!j.token) throw new Error('Přihlášení do adminu selhalo: ' + JSON.stringify(j).slice(0, 200));
  token = j.token;
  return token;
};

export const api = async (p, body, method) => {
  if (!token) await prihlasit();
  const init = {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  };
  /* Po dlouhé pauze (smoke-order běží synchronně) server zavře udržované
     spojení → ECONNRESET. Jeden nový pokus stačí. */
  const r = await fetch(CIL + p, init).catch(() => fetch(CIL + p, init));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method ?? (body ? 'POST' : 'GET')} ${p} → ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
};

export const jenSandbox = () => {
  if (!/localhost|127\.0\.0\.1/.test(CIL)) throw new Error('Nahrávání scénářů jen proti sandboxu (localhost).');
};
