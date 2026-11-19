/**
 * Pošle nahrané GIFy (tools/navod/.vystup) do backendu: soubor do úložiště
 * (na produkci R2), klíč → adresa do tabulky navod_klip.
 *
 *   node tools/navod/nahrat.mjs                       # sandbox
 *   CIL=https://admin.keramickazahrada.cz EMAIL=… HESLO=… node tools/navod/nahrat.mjs
 *   … nahrat.mjs produkt.  # jen klíče obsahující text
 */
import fs from 'node:fs';
import path from 'node:path';
import { api, CIL } from './lib/api.mjs';

const VYSTUP = path.resolve(import.meta.dirname, '.vystup');
const manifest = JSON.parse(fs.readFileSync(path.join(VYSTUP, 'manifest.json'), 'utf8'));
const filtr = process.argv.slice(2);
let n = 0, kb = 0;
for (const [klic, m] of Object.entries(manifest)) {
  if (filtr.length && !filtr.some((f) => klic.includes(f))) continue;
  const buf = fs.readFileSync(path.join(VYSTUP, m.soubor));
  await api('/admin/navod/klipy', { key: klic, area: m.oblast, gif_base64: buf.toString('base64'), width: m.width, height: m.height });
  n++; kb += buf.length / 1024;
  console.log(`↑ ${klic} (${(buf.length / 1024).toFixed(0)} kB)`);
}
console.log(`hotovo: ${n} klipů, ${(kb / 1024).toFixed(1)} MB → ${CIL}`);
