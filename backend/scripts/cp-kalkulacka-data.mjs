/**
 * Ceník ČP do zahraničí → `src/lib/cp-kalkulacka/data.ts` (TS konstanta, ne
 * import .json — build Medusy by .json nemusel přibalit).
 *
 *   node backend/scripts/cp-kalkulacka-data.mjs [docs/cp-kalkulacka/cp-ceny-zahranici.json]
 *
 * Zdrojový JSON stáhne `docs/cp-kalkulacka/stahni.mjs` (~20 min, veřejná
 * kalkulačka postaonline.cz). Po změně ceníku ČP (typicky k 1. 1.) stáhnout,
 * spustit tenhle převod a commitnout.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const src = path.resolve(process.argv[2] ?? path.join(root, 'docs/cp-kalkulacka/cp-ceny-zahranici.json'));
const out = path.resolve(import.meta.dirname, '..', 'src/lib/cp-kalkulacka/data.ts');
const raw = JSON.parse(fs.readFileSync(src, 'utf8'));

const services = [...raw.services];
const countries = {};
for (const [code, entry] of Object.entries(raw.countries)) {
  const products = entry.products ?? {};
  const svc = {};
  for (const [name, tiers] of Object.entries(products)) {
    const index = services.indexOf(name);
    if (index < 0 || !tiers?.length) continue;
    /* [do kg, cena s DPH v Kč] — zákazník platí cenu s DPH */
    svc[index] = tiers.map(([kg, withVat]) => [kg, withVat]);
  }
  countries[code.toLowerCase()] = { n: entry.name ?? code.toUpperCase(), s: svc };
}

const body = `/* eslint-disable */
// VYGENEROVÁNO skriptem backend/scripts/cp-kalkulacka-data.mjs — neupravovat ručně.
// Zdroj: veřejná kalkulačka České pošty (${raw.source ?? 'postaonline.cz'}), staženo ${raw.fetched_at}.
// ${raw.note ?? ''}

export const CP_FETCHED_AT = ${JSON.stringify(raw.fetched_at)}

/** Služby ČP (názvy jak je vrací kalkulačka). Index = klíč v \`s\` u země. */
export const CP_SERVICES: string[] = ${JSON.stringify(services)}

/** země (ISO 2, malými) → { n: český název, s: { index služby: [[do kg, cena s DPH v Kč], …] } } */
export const CP_COUNTRIES: Record<string, { n: string; s: Record<string, Array<[number, number]>> }> = ${JSON.stringify(countries)}
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, body);
const withParcels = Object.values(countries).filter((c) => Object.keys(c.s).length).length;
console.log(`${out}: ${Object.keys(countries).length} zemí (${withParcels} s balíkem), ${services.length} služby, ${(body.length / 1024).toFixed(0)} kB`);
