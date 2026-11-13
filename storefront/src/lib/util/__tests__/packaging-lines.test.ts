import { test } from "node:test"
import assert from "node:assert/strict"
import { dobirkaFeeSubtotal, withPackagingUnderProducts } from "../packaging"

const vyrobek = { id: "v", variant_id: "var_1", product_id: "p_1", metadata: {}, unit_price: 490, quantity: 1 }
const balne = { id: "b", variant_id: null, product_id: null, metadata: { packaging_fee: true, packaging_variant_id: "var_1" }, unit_price: 40, quantity: 1 }
const dobirka = { id: "d", variant_id: null, product_id: null, metadata: { dobirka_fee: true }, unit_price: 39, quantity: 1 }

test("doběrečné není položka — v seznamu položek není", () => {
  const ids = withPackagingUnderProducts([dobirka, vyrobek, balne] as any[]).map((x: any) => x.id)
  assert.deepEqual(ids, ["v", "b"])
})

test("doběrečné zůstává v součtu jako platba", () => {
  assert.equal(dobirkaFeeSubtotal([dobirka, vyrobek, balne] as any[]), 39)
})
