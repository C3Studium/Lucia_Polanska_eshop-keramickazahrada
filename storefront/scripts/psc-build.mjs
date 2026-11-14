// PSČ → obce pro doplňování města v adrese (14. 11. 2026).
//
// 1) Stáhnout v prohlížeči: Česká pošta → Zákaznické výstupy →
//    „Seznam PSČ částí obcí a obcí bez částí" (db_pcobc, CSV v zipu)
//    https://www.ceskaposta.cz/ke-stazeni/zakaznicke-vystupy
// 2) Rozbalit a spustit:  node scripts/psc-build.mjs cesta/k/souboru.csv
// 3) Commitnout src/lib/data/psc-obce.json (aktualizace stačí jednou za čas).
//
// Soubor bývá ve windows-1250; skript to pozná a převede.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { obceZRadku } from "../src/lib/util/psc.ts"

const vstup = process.argv[2]
if (!vstup) {
  console.error("Použití: node scripts/psc-build.mjs <db_pcobc.csv>")
  process.exit(1)
}
const bajty = fs.readFileSync(vstup)
let text = new TextDecoder("utf-8", { fatal: false }).decode(bajty)
if (text.includes("�")) text = new TextDecoder("windows-1250").decode(bajty)
const mapa = obceZRadku(text)
const cil = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/data/psc-obce.json")
fs.writeFileSync(cil, JSON.stringify(mapa))
console.log(`PSČ: ${Object.keys(mapa).length}, zapsáno do ${cil}`)
