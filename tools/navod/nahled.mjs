/**
 * Kontaktní arch GIFu: vybrané snímky vedle sebe do jednoho PNG (kontrola
 * nahrávky bez přehrávače).  node tools/navod/nahled.mjs <gif> [počet=8] [výstup.png]
 */
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(path.resolve(import.meta.dirname, '../../backend/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp'));

const [soubor, pocetArg, vystupArg] = process.argv.slice(2);
const pocet = Number(pocetArg ?? 8);
const meta = await sharp(soubor, { animated: true }).metadata();
const strany = meta.pages ?? 1;
const vyska = meta.pageHeight ?? meta.height;
const vyber = [...new Set(Array.from({ length: pocet }, (_, i) => Math.round((i * (strany - 1)) / Math.max(1, pocet - 1))))];
const sirka = 520;
const dlazdice = await Promise.all(vyber.map((page) => sharp(soubor, { page, pages: 1 }).resize({ width: sirka }).png().toBuffer()));
const h = Math.round((vyska * sirka) / meta.width);
const sloupcu = 2;
const radku = Math.ceil(dlazdice.length / sloupcu);
const out = vystupArg ?? soubor.replace(/\.gif$/, '.nahled.png');
await sharp({ create: { width: sirka * sloupcu + 8 * (sloupcu - 1), height: h * radku + 8 * (radku - 1), channels: 3, background: '#888' } })
  .composite(dlazdice.map((input, i) => ({ input, left: (i % sloupcu) * (sirka + 8), top: Math.floor(i / sloupcu) * (h + 8) })))
  .png().toFile(out);
console.log(out, `${strany} snímků, ukázáno ${vyber.join(',')}`);
