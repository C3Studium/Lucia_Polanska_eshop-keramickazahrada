import { test } from "node:test"
import assert from "node:assert/strict"
import { zpravaProPole } from "../field-error"

const v = (over: Partial<ValidityState>): ValidityState =>
  ({
    valueMissing: false,
    typeMismatch: false,
    patternMismatch: false,
    tooShort: false,
    tooLong: false,
    rangeUnderflow: false,
    rangeOverflow: false,
    stepMismatch: false,
    badInput: false,
    customError: false,
    valid: false,
    ...over,
  }) as ValidityState

test("prázdné povinné pole", () => {
  assert.equal(zpravaProPole(v({ valueMissing: true }), "text"), "Vyplňte prosím toto pole.")
})
test("špatný e-mail říká, jak má vypadat", () => {
  assert.equal(
    zpravaProPole(v({ typeMismatch: true }), "email"),
    "Zadejte e-mail ve tvaru jmeno@domena.cz."
  )
})
test("krátké heslo a špatný formát", () => {
  assert.equal(zpravaProPole(v({ tooShort: true }), "password", { minLength: 8 }), "Zadejte aspoň 8 znaků.")
  assert.equal(zpravaProPole(v({ patternMismatch: true }), "text"), "Zkontrolujte prosím, jestli je to napsané správně.")
})
test("vlastní hláška pole má přednost", () => {
  assert.equal(zpravaProPole(v({ customError: true }), "text", { vlastni: "PSČ má 5 číslic." }), "PSČ má 5 číslic.")
})
test("platné pole nemá hlášku", () => {
  assert.equal(zpravaProPole(v({ valid: true }), "text"), null)
})
