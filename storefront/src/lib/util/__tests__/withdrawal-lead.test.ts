import { test } from "node:test"
import assert from "node:assert/strict"
import { withdrawalLead } from "../withdrawal-lead"

const texty = {
  "order.withdrawal_1": "Rozmysleli jste si to? …",
  "order.withdrawal_2": "Od smlouvy můžete odstoupit bez udání důvodu do $",
}

test("s datem lhůty složí větu, ne doslovný kód", () => {
  const veta = withdrawalLead({ kind: "available", deadlineText: "27. 11. 2026" } as any, "delivered", texty)
  assert.equal(veta, "Od smlouvy můžete odstoupit bez udání důvodu do 27. 11. 2026 (14 dnů od převzetí zboží).")
  assert.ok(!veta.includes("{texty"))
  assert.ok(!veta.includes("$"))
})

test("před odesláním věta 1", () => {
  assert.equal(withdrawalLead({ kind: "available" } as any, "not_shipped", texty), "Rozmysleli jste si to? …")
})

test("bez data obecná věta, nedostupné vlastní text", () => {
  assert.match(withdrawalLead({ kind: "available" } as any, "delivered", texty), /do 14 dnů od převzetí/)
  assert.equal(withdrawalLead({ kind: "blocked", text: "Lhůta uplynula." } as any, "delivered", texty), "Lhůta uplynula.")
})
