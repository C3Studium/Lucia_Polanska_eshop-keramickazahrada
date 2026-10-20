import { MedusaError } from "@medusajs/framework/utils"
import { aggregateProductionBlocks, commissionIdFromRequestLines, productionBlockOf } from "../claims/production"
import { findOpenBalanceCollection } from "../balance-payment"
import {
  commissionExtrasTotal,
  commissionItemTotal,
  commissionMoney,
  isLegacyCommission,
  sumCommissionMoney,
} from "../made-to-order/commission-money"
import { commissionLineOf, commissionTitleOf } from "../made-to-order/commission-line"
import { commissionRefundablePaid, openCommissionCancelRequest } from "../made-to-order/customer-cancel"
import { pickCommission, sortCommissions } from "../made-to-order/orders-of"

/**
 * LEGAL_AUDIT.md § 0c (Z-A): zakázka = položka objednávky. Čisté výpočty
 * peněz za položku vs. za objednávku, výběr zakázky a chování legacy zakázky
 * (bez `line_item_id` = celá objednávka, čísla jako dřív).
 */

const paid = (type: "deposit" | "balance", amount: number) => ({ type, status: "paid", amount })

describe("commissionMoney — zakázka nesoucí objednávku vs. ostatní", () => {
  const carrier = {
    id: "po_1",
    line_item_id: "ordli_a",
    line_total: 5000,
    original_total: 5499, // + hrnek 400 + doprava 99
    agreed_total: 5499,
    order_extras_paid: 400,
  }

  it("rozdělí zálohu a dluh na položku a na objednávku", () => {
    const money = commissionMoney(carrier, [paid("deposit", 1650)])
    expect(money).toMatchObject({
      item_total: 5000,
      extras_total: 499,
      extras_paid: 400,
      extras_outstanding: 99,
      deposit_paid_raw: 1650,
      deposit_paid: 1250,
      balance_paid: 0,
      outstanding: 3849,
      item_outstanding: 3750,
      carries_order_extras: true,
      legacy: false,
    })
  })

  it("po zaplaceném doplatku (včetně dopravy) nedluží položka ani objednávka nic", () => {
    const money = commissionMoney(carrier, [paid("deposit", 1650), paid("balance", 3849)])
    expect(money.outstanding).toBe(0)
    expect(money.item_outstanding).toBe(0)
    expect(money.extras_outstanding).toBe(0)
  })

  it("druhá zakázka objednávky nenese nic navíc", () => {
    const money = commissionMoney(
      { id: "po_2", line_item_id: "ordli_b", line_total: 2000, original_total: 2000, agreed_total: 2000 },
      [paid("deposit", 500)]
    )
    expect(money).toMatchObject({ item_total: 2000, extras_total: 0, deposit_paid: 500, outstanding: 1500, item_outstanding: 1500 })
  })

  it("legacy zakázka (bez řádku) = celá objednávka, čísla jako dřív", () => {
    const legacy = { id: "po_old", line_item_id: null, original_total: 2579, agreed_total: null, surcharge: 100 }
    expect(isLegacyCommission(legacy)).toBe(true)
    expect(commissionExtrasTotal(legacy)).toBe(0)
    expect(commissionItemTotal(legacy)).toBe(2579)
    const money = commissionMoney(legacy, [paid("deposit", 600)])
    expect(money).toMatchObject({ item_total: 2579, deposit_paid: 600, outstanding: 2079, item_outstanding: 2079, legacy: true })
  })

  it("zrušená zakázka nedluží nic; součty za objednávku sčítají surové zálohy", () => {
    const totals = sumCommissionMoney([
      commissionMoney(carrier, [paid("deposit", 1650)]),
      commissionMoney({ id: "po_2", line_item_id: "ordli_b", line_total: 2000, original_total: 2000, stage: "cancelled" }, [paid("deposit", 500)]),
    ])
    expect(totals).toEqual({ deposit_paid: 2150, balance_paid: 0, outstanding: 3849, extras_outstanding: 99 })
  })
})

describe("commissionRefundablePaid — co se vrací za jednu položku", () => {
  it("poslední položka objednávky vrací vše včetně dopravy", () => {
    expect(commissionRefundablePaid({ paidRemaining: 1650, extrasTotal: 499, extrasOutstanding: 99, lastItemInOrder: true })).toBe(1650)
  })
  it("když zbývají další položky, doprava a běžné zboží se nevrací", () => {
    expect(commissionRefundablePaid({ paidRemaining: 1650, extrasTotal: 499, extrasOutstanding: 99, lastItemInOrder: false })).toBe(1250)
  })
})

describe("výběr zakázky objednávky", () => {
  const a = { id: "po_a", created_at: "2026-10-20T10:00:00Z", line_item_id: "ordli_a" }
  const b = { id: "po_b", created_at: "2026-10-20T10:00:01Z", line_item_id: "ordli_b" }

  it("pořadí podle vzniku, první nese objednávku", () => {
    expect(sortCommissions([b, a]).map((c) => c.id)).toEqual(["po_a", "po_b"])
  })

  it("bez id a jedna → ta; bez id a víc → chyba; cizí id → 404", () => {
    expect(pickCommission([a])).toBe(a)
    expect(pickCommission([a, b], "po_b")).toBe(b)
    expect(pickCommission([], "po_a")).toBeNull()
    expect(() => pickCommission([a, b])).toThrow(MedusaError)
    expect(() => pickCommission([a, b])).toThrow("Objednávka má víc zakázek — uveďte production_order_id.")
    expect(() => pickCommission([a], "po_x")).toThrow("Zakázka k této objednávce nebyla nalezena.")
  })

  it("žádost v Reklamace a zrušení najde zakázku podle vybraného řádku", () => {
    expect(commissionIdFromRequestLines({ line_items: [{ line_item_id: "ordli_b" }] }, [a, b])).toBe("po_b")
    expect(commissionIdFromRequestLines({ line_items: null }, [a, b])).toBeNull()
    expect(commissionIdFromRequestLines({ line_items: [{ line_item_id: "ordli_a" }, { line_item_id: "ordli_b" }] }, [a, b])).toBeNull()
  })

  it("otevřená žádost o zrušení blokuje jen svou zakázku; stará žádost bez řádků blokuje všechny", () => {
    const requests = [{ kind: "zruseni_zakazky", status: "approved", line_items: [{ line_item_id: "ordli_a" }] }]
    expect(openCommissionCancelRequest(requests, "ordli_a")).toBeTruthy()
    expect(openCommissionCancelRequest(requests, "ordli_b")).toBeNull()
    expect(openCommissionCancelRequest([{ kind: "zruseni_zakazky", status: "approved", line_items: null }], "ordli_b")).toBeTruthy()
    expect(openCommissionCancelRequest([{ kind: "zruseni_zakazky", status: "rejected", line_items: null }], null)).toBeNull()
  })
})

describe("commissionLineOf / commissionTitleOf", () => {
  const order = {
    items: [
      { id: "ordli_a", product_title: "Domovní číslo", variant_title: "Modrá", thumbnail: "https://img/a.jpg", metadata: { made_to_order: {} } },
      { id: "ordli_pack", title: "Balné — Domovní číslo", metadata: { packaging_fee: true } },
      { id: "ordli_b", product_title: "Pítko", metadata: { made_to_order: {} } },
    ],
  }
  it("nová zakázka podle řádku, snímek názvu má přednost (řádek mohl zmizet)", () => {
    expect(commissionLineOf(order, { line_item_id: "ordli_b" })?.product_title).toBe("Pítko")
    expect(commissionTitleOf(order, { line_item_id: "ordli_zmizel", line_title: "Mísa" })).toBe("Mísa")
    expect(commissionTitleOf(order, { line_item_id: "ordli_zmizel" })).toBeNull()
  })
  it("legacy zakázka = první zakázkový řádek (bez balného), jako dřív", () => {
    expect(commissionLineOf(order, { line_item_id: null })?.id).toBe("ordli_a")
    expect(commissionTitleOf(order, null)).toBe("Domovní číslo")
  })
})

describe("aggregateProductionBlocks — souhrn víc zakázek pro žádost", () => {
  const block = (over: Record<string, unknown>) =>
    productionBlockOf(
      { id: "po", stage: "confirmed", original_total: 1000, deposit_percentage: 25, deposit_amount: 250, ...over },
      [paid("deposit", 250)]
    )
  it("sčítá peníze, fáze zrušená jen když jsou zrušené všechny", () => {
    const sum = aggregateProductionBlocks([block({ id: "po_a" }), block({ id: "po_b", stage: "cancelled", cancelled_at: "2026-10-20T10:00:00Z", cancelled_by: "customer" })])
    expect(sum.deposit_paid).toBe(500)
    expect(sum.outstanding).toBe(750)
    expect(sum.stage).toBe("confirmed")
    expect(sum.cancelled_at).toBeNull()
    const all = aggregateProductionBlocks([block({ id: "po_a", stage: "cancelled", cancelled_at: "2026-10-21T10:00:00Z", cancelled_by: "customer" }), block({ id: "po_b", stage: "cancelled", cancelled_at: "2026-10-20T10:00:00Z", cancelled_by: "customer" })])
    expect(all.stage).toBe("cancelled")
    expect(all.cancelled_at).toBe("2026-10-21T10:00:00.000Z")
    expect(all.cancelled_by).toBe("customer")
  })
})

describe("findOpenBalanceCollection — kolekce doplatku per zakázka", () => {
  const order = {
    payment_collections: [
      { id: "pc_a", status: "not_paid", captured_amount: 0, metadata: { made_to_order_balance: true, production_order_id: "po_a" } },
      { id: "pc_b", status: "not_paid", captured_amount: 0, metadata: { made_to_order_balance: true, production_order_id: "po_b" } },
      { id: "pc_paid", status: "authorized", captured_amount: 100, metadata: {} },
    ],
  }
  it("vrátí kolekci své zakázky a cizí si nepřetáhne", () => {
    expect(findOpenBalanceCollection(order, "po_b")?.id).toBe("pc_b")
    expect(findOpenBalanceCollection(order, "po_c")).toBeNull()
  })
  it("starší objednávka: značená bez zakázky platí pro jedinou zakázku; bez značky jen bez zadané zakázky", () => {
    const legacy = { payment_collections: [{ id: "pc_old", status: "not_paid", captured_amount: 0, metadata: { made_to_order_balance: true } }] }
    expect(findOpenBalanceCollection(legacy, "po_a")?.id).toBe("pc_old")
    const unflagged = { payment_collections: [{ id: "pc_x", status: "awaiting", captured_amount: 0, metadata: {} }] }
    expect(findOpenBalanceCollection(unflagged)?.id).toBe("pc_x")
    expect(findOpenBalanceCollection(unflagged, "po_a")?.id).toBe("pc_x")
  })
})
