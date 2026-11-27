/**
 * Testy rozhodování o Ahrefs Web Analytics — bez prohlížeče a bez sestavení.
 *
 *   cd storefront
 *   node --experimental-strip-types --test src/modules/analytics/ahrefs.test.mjs
 */

import assert from "node:assert/strict"
import test from "node:test"

import { ahrefsPlan, isPrivateUrl } from "./ahrefs.ts"

test("stránky s přístupovým tokenem nebo osobními údaji jsou soukromé", () => {
  for (const [path, search] of [
    ["/cz/order/order_01ABC/edit", "?token=abc.def"],
    ["/cz/order/order_01ABC/transfer/eyJhbGciOi", ""],
    ["/cz/order/order_01ABC/confirmed", ""],
    ["/cz/kurzy/rezervace/res_01", "?token=x"],
    ["/cz/poukaz/gv_01", "?token=x"],
    ["/cz/account", ""],
    ["/cz/account/orders", ""],
    ["/cz/reset-password", "?token=x&email=a%40b.cz"],
    ["/cz/verify-email", "?token=x"],
    ["/studio", ""],
    ["/studio/pages", ""],
  ]) {
    assert.equal(isPrivateUrl(path, search), true, `${path}${search}`)
  }
})

test("jakákoli adresa s tajným parametrem je soukromá, i mimo známé cesty", () => {
  assert.equal(isPrivateUrl("/cz/newsletter", "?token=x"), true)
  assert.equal(isPrivateUrl("/cz", "?email=a%40b.cz"), true)
  assert.equal(isPrivateUrl("/cz/store", "?access_key=1"), true)
  assert.equal(isPrivateUrl("/cz/store", "?code=SLEVA10"), true)
})

test("obchod, výrobky, košík a pokladna se měří", () => {
  for (const [path, search] of [
    ["/cz", ""],
    ["/cz/store", "?kategorie=zapichy&sort=price_asc"],
    ["/cz/products/keramicky-zapich-zimni-chaloupka", ""],
    ["/cz/cart", ""],
    ["/cz/checkout", "?step=delivery"],
    ["/cz/kurzy", ""],
    ["/cz", "?utm_source=facebook&utm_medium=social"],
    ["/en/orderly-garden", ""],
  ]) {
    assert.equal(isPrivateUrl(path, search), false, `${path}${search}`)
  }
})

test("bez souhlasu s analytikou se nic nenačte a načtený skript mlčí", () => {
  assert.deepEqual(ahrefsPlan(false, "/cz", "", false), { kind: "silent" })
  assert.deepEqual(ahrefsPlan(false, "/cz", "", true), { kind: "silent" })
})

test("se souhlasem na veřejné stránce se skript načte jednou a měří", () => {
  assert.deepEqual(ahrefsPlan(true, "/cz", "", false), { kind: "track", load: true })
  assert.deepEqual(ahrefsPlan(true, "/cz/store", "", true), { kind: "track", load: false })
})

test("se souhlasem na soukromé stránce skript mlčí a nenačítá se", () => {
  assert.deepEqual(ahrefsPlan(true, "/cz/order/o_1/edit", "?token=x", false), { kind: "silent" })
  assert.deepEqual(ahrefsPlan(true, "/cz/order/o_1/edit", "?token=x", true), { kind: "silent" })
})
