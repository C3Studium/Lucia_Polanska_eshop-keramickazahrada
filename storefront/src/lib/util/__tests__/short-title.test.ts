import { test } from "node:test"
import assert from "node:assert/strict"
import { shortTitle } from "../short-title"

test("krátký název zůstává", () => {
  assert.equal(shortTitle("Zvonkové tlačítko"), "Zvonkové tlačítko")
  assert.equal(shortTitle("Keramické zahradní pítko"), "Keramické zahradní pítko")
})
test("dlouhý název se zkrátí na 3 slova a tři tečky", () => {
  assert.equal(shortTitle("Keramické zahradní pítko s ptáčky"), "Keramické zahradní pítko…")
})
test("pomlčky a oddělovače na konci se nenechávají", () => {
  assert.equal(shortTitle("Keramická plastika Slunce - Sluneční žena Červenec - NA ZAKÁZKU"), "Keramická plastika Slunce…")
  assert.equal(shortTitle("Zvonkové tlačítko, Hvězdné"), "Zvonkové tlačítko, Hvězdné")
  assert.equal(shortTitle("Zvonkové tlačítko - Jeřabina zimní"), "Zvonkové tlačítko…")
})
test("krátké spojky se nepočítají jako slovo na konci", () => {
  assert.equal(shortTitle("Miska s ptáčky a kytičkou"), "Miska s ptáčky…")
})
test("prázdné a zdvojené mezery", () => {
  assert.equal(shortTitle(""), "")
  assert.equal(shortTitle("Zvonkové tlačítko  Cínie smetanová"), "Zvonkové tlačítko Cínie…")
})
