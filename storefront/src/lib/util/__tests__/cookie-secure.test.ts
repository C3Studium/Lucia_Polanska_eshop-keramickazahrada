import { test } from "node:test"
import assert from "node:assert/strict"
import { cookieSecure } from "../cookie-secure"

test("produkce na https drží cookie secure", () => {
  assert.equal(cookieSecure("production", "https://keramickazahrada.cz"), true)
})

test("produkční build na http adrese v síti (iPhone test) secure nemá", () => {
  assert.equal(cookieSecure("production", "http://192.168.1.31:4700"), false)
})

test("vývoj secure nemá", () => {
  assert.equal(cookieSecure("development", "https://keramickazahrada.cz"), false)
})

test("bez adresy obchodu se v produkci drží secure", () => {
  assert.equal(cookieSecure("production", undefined), true)
})
