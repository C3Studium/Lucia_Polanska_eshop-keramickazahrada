import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizujPsc, obceZRadku } from "../psc"

test("PSČ: mezery pryč, jen pět číslic", () => {
  assert.equal(normalizujPsc("397 01"), "39701")
  assert.equal(normalizujPsc(" 39701 "), "39701")
  assert.equal(normalizujPsc("3970"), null)
  assert.equal(normalizujPsc("SK-811 01"), null)
})

test("převod CSV České pošty: obec podle PSČ, bez opakování, abecedně", () => {
  const csv = [
    "NAZCOBCE;PSC;NAZPOST;KODOKRESU;NAZOKRESU;NAZOBCE;KOD",
    "Písek;39701;Písek 1;3307;Písek;Písek;549240",
    "Budějovické Předměstí;39701;Písek 1;3307;Písek;Písek;549240",
    "Semice;39701;Písek 1;3307;Písek;Semice;551112",
    "Putim;39701;Písek 1;3307;Písek;Putim;549711",
  ].join("\n")
  assert.deepEqual(obceZRadku(csv), { "39701": ["Písek", "Putim", "Semice"] })
})
