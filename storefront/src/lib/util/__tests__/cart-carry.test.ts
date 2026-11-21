import { test } from "node:test"
import assert from "node:assert/strict"
import { carriableLines } from "../cart-carry"

test("převod košíku vynechá balné a doběrečné — server je založí znovu sám", () => {
  const items = [
    { id: "a", variant_id: "variant_1", metadata: {} },
    {
      id: "b",
      variant_id: null,
      product_id: null,
      metadata: { packaging_fee: true, packaging_variant_id: "variant_1", packaging_product_id: "prod_1" },
    },
    { id: "c", variant_id: null, product_id: null, metadata: { dobirka_fee: true } },
    { id: "d", variant_id: "variant_2", metadata: { bundle_group_id: "g1" } },
  ]
  assert.deepEqual(
    carriableLines(items).map((i) => i.id),
    ["a", "d"]
  )
})

test("řádek bez varianty se nepřenáší (zákaznická cesta variantu vyžaduje)", () => {
  assert.deepEqual(carriableLines([{ id: "x", variant_id: null, metadata: {} }]), [])
  assert.deepEqual(carriableLines(null), [])
})
