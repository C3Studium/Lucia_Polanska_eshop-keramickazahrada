import { test } from "node:test"
import assert from "node:assert/strict"
import { priceTiers, sharedPriceTiers } from "../../../modules/kurzy/format"

const termin = { price_single: 500, price_two: 450, group_min: 3, price_group_per_person: 350, price_child: 430, child_max_age: 15 }

test("jen dospělý a dítě — žádné „Dva lidé / Od 3 lidí“", () => {
  const t = priceTiers(termin)
  assert.deepEqual(t.map((x) => [x.key, x.label, x.perPerson]), [
    ["single", "Dospělý", 500],
    ["child", "Dítě do 15 let", 430],
  ])
})

test("bez dětské ceny jen dospělý", () => {
  assert.deepEqual(priceTiers({ ...termin, price_child: null }).map((x) => x.key), ["single"])
})

test("společný žebříček pro stejné ceny", () => {
  assert.equal(sharedPriceTiers([termin, termin])?.length, 2)
})
