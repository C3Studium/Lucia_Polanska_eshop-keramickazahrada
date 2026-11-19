/**
 * Sedí katalog textů, natočené klipy a otazníky v kódu?
 *   node tools/navod/kontrola-katalogu.mjs
 * Hlásí: klip bez textu, text bez klipu, otazník na neexistující téma,
 * téma, na které žádný otazník nevede (najde se jen na stránce Návod).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const kat = fs.readFileSync(path.join(root, 'backend/src/admin/lib/navod-katalog.ts'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '.vystup/manifest.json'), 'utf8'));
const klipyVKatalogu = [...kat.matchAll(/klic: "([a-z0-9.-]+)", popis/g)].map((x) => x[1]);
const temata = [...kat.matchAll(/klic: "([a-z0-9.-]+)",\s*\n\s*sekce/g)].map((x) => x[1]);

const tipy = new Set();
const projit = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) projit(p);
    else if (/\.tsx?$/.test(e.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/(?:tema|tip)="([a-z0-9.-]+)"/g)) tipy.add(m[1]);
  }
};
projit(path.join(root, 'backend/src/admin'));

const vypis = (nadpis, seznam) => console.log(`${nadpis}: ${seznam.length ? seznam.join(', ') : '—'}`);
const adminKlipy = Object.entries(manifest).filter(([, m]) => m.oblast === 'admin').map(([k]) => k);
vypis('klipy bez textu', adminKlipy.filter((k) => !klipyVKatalogu.includes(k)));
vypis('texty bez klipu', [...new Set(klipyVKatalogu)].filter((k) => !manifest[k]));
vypis('otazník na neexistující téma', [...tipy].filter((t) => !temata.includes(t)));
vypis('témata bez otazníku', temata.filter((t) => !tipy.has(t)));
console.log(`témat ${temata.length}, otazníků ${tipy.size}, klipů admin ${adminKlipy.length}`);
