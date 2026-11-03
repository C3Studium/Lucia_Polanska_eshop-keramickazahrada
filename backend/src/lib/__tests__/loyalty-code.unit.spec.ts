import path from "path"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { looksLikeVoucherCode } from "../../modules/gift-voucher/code"
import {
  autoCampaignIdentifier,
  buildLoyaltyPromotion,
  decideAutomaticLoyaltyCode,
  isPaidOrder,
  LOYALTY_CODE_DEFAULTS,
  loyaltyCodeState,
  makeLoyaltyCode,
  manualCampaignIdentifier,
  normalizeLoyaltySettings,
  paidOrderCount,
  type AutoLoyaltyInput,
} from "../loyalty-code-rules"
import { createLoyaltyCode, loadLoyaltyPerson, manualBlockReason } from "../loyalty-code"

/*
 * Výpočet akcí Medusy (2.18) — stejné funkce, které běží v košíku. Čteme je
 * přímo z balíčku, ať test ověřuje skutečné chování, ne naši představu o něm.
 */
const promotionDist = path.dirname(require.resolve("@medusajs/promotion/package.json"))
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { areRulesValidForContext } = require(path.join(promotionDist, "dist/utils/validations/promotion-rule.js"))
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getComputedActionsForItems } = require(path.join(promotionDist, "dist/utils/compute-actions/line-items.js"))

/** Pravidla tak, jak je modul načte z databáze (hodnoty jako `{ value }`). */
const asStoredRules = (rules: Array<{ attribute: string; operator: string; values: string[] }>) =>
  rules.map((rule) => ({ ...rule, values: rule.values.map((value) => ({ value })) }))

const promotionFor = (customerIds: string[]) =>
  buildLoyaltyPromotion({
    code: "DIKY-ABCDEF",
    percentage: 10,
    startsAt: new Date("2026-11-03T10:00:00Z"),
    endsAt: new Date("2027-01-02T10:00:00Z"),
    customerIds,
    campaignIdentifier: "kz-kod-cus_A-DIKY-ABCDEF",
    campaignName: "Kód pro zákazníka — jana@example.com",
  })

describe("kód a akce", () => {
  it("kód má tvar DIKY-XXXXXX bez zaměnitelných znaků a nikdy nevypadá jako poukaz", () => {
    for (let index = 0; index < 200; index += 1) {
      const code = makeLoyaltyCode()
      expect(code).toMatch(/^DIKY-[A-HJ-NP-Z2-9]{6}$/)
      expect(looksLikeVoucherCode(code)).toBe(false)
    }
  })

  it("akce je aktivní, procentní na objednávku, s jedním použitím a pravidlem na zákazníka", () => {
    const promotion = promotionFor(["cus_A", "cus_B", "cus_A"])
    expect(promotion.status).toBe("active")
    expect(promotion.is_automatic).toBe(false)
    expect(promotion.application_method).toEqual({
      type: "percentage",
      target_type: "order",
      allocation: "across",
      value: 10,
    })
    expect(promotion.rules).toEqual([
      { attribute: "customer.id", operator: "in", values: ["cus_A", "cus_B"] },
    ])
    expect(promotion.campaign.budget).toEqual({ type: "usage", limit: 1 })
    expect(promotion.campaign.ends_at.toISOString()).toBe("2027-01-02T10:00:00.000Z")
  })

  it("bez zákazníka akci nepostaví — kód pro kohokoli vzniknout nesmí", () => {
    expect(() => promotionFor([])).toThrow()
  })

  it("Medusa pustí kód jen košíku téhož zákazníka (účet i dřívější host)", () => {
    const rules = asStoredRules(promotionFor(["cus_A", "cus_B"]).rules)
    expect(areRulesValidForContext(rules, { customer: { id: "cus_A" } }, "order")).toBe(true)
    expect(areRulesValidForContext(rules, { customer: { id: "cus_B" } }, "order")).toBe(true)
    expect(areRulesValidForContext(rules, { customer: { id: "cus_CIZI" } }, "order")).toBe(false)
    // Košík bez zákazníka (host ještě nevyplnil e-mail) kód taky nedostane.
    expect(areRulesValidForContext(rules, {}, "order")).toBe(false)
    expect(areRulesValidForContext(rules, { customer: null }, "order")).toBe(false)
  })

  it("sleva se počítá jen z položek, které ji smí dostat (výprodej, Bez slev. kódů, balné…)", () => {
    const promotion = { ...promotionFor(["cus_A"]), is_tax_inclusive: false }
    const items = [
      { id: "hrnek", quantity: 1, subtotal: 1000, original_total: 1000, is_discountable: true },
      { id: "vyprodej", quantity: 1, subtotal: 500, original_total: 500, is_discountable: false },
      { id: "balne", quantity: 1, subtotal: 50, original_total: 50, is_discountable: false },
    ]
    const actions = getComputedActionsForItems(promotion, items, new Map(), "across")
    expect(actions.map((action: any) => action.item_id)).toEqual(["hrnek"])
    expect(Number(actions[0].amount)).toBeCloseTo(100)
  })

  it("identifikátor automatického kódu je pevný pro zákazníka a hranici, ruční nese kód", () => {
    expect(autoCampaignIdentifier("cus_A", 3)).toBe("kz-kod-cus_A-po-3")
    expect(autoCampaignIdentifier("cus_A", 3)).toBe(autoCampaignIdentifier("cus_A", 3))
    expect(manualCampaignIdentifier("cus_A", "DIKY-ABCDEF")).toBe("kz-kod-cus_A-DIKY-ABCDEF")
  })

  it("stav kódu: platí / použitý / propadlý", () => {
    const now = new Date("2026-11-10T00:00:00Z")
    expect(loyaltyCodeState({ ends_at: "2026-12-01", budget: { used: 0, limit: 1 } }, now)).toBe("active")
    expect(loyaltyCodeState({ ends_at: "2026-12-01", budget: { used: 1, limit: 1 } }, now)).toBe("used")
    expect(loyaltyCodeState({ ends_at: "2026-11-01", budget: { used: 0, limit: 1 } }, now)).toBe("expired")
  })
})

describe("nastavení", () => {
  it("výchozí: automat vypnutý, po 3. objednávce, 10 %, 60 dní", () => {
    expect(normalizeLoyaltySettings(undefined)).toEqual(LOYALTY_CODE_DEFAULTS)
    expect(LOYALTY_CODE_DEFAULTS).toEqual({ auto_enabled: false, after_orders: 3, percentage: 10, valid_days: 60 })
  })

  it("hodnoty mimo meze se srovnají, automat zapne jen skutečné true", () => {
    expect(
      normalizeLoyaltySettings({ auto_enabled: "true", after_orders: 1, percentage: 90, valid_days: 0 })
    ).toEqual({ auto_enabled: false, after_orders: 2, percentage: 50, valid_days: 1 })
  })
})

describe("zaplacená objednávka", () => {
  it("počítá se jen nezrušená se zachycenou platbou", () => {
    expect(isPaidOrder({ id: "a", payment_collections: [{ payments: [{ captured_at: "2026-11-01" }] }] })).toBe(true)
    expect(isPaidOrder({ id: "b", payment_collections: [{ status: "partially_captured", payments: [] }] })).toBe(true)
    expect(isPaidOrder({ id: "c", payment_collections: [{ status: "authorized", payments: [{ captured_at: null }] }] })).toBe(false)
    expect(isPaidOrder({ id: "d", status: "canceled", payment_collections: [{ status: "completed" }] })).toBe(false)
    expect(isPaidOrder({ id: "e", payment_collections: [] })).toBe(false)
  })

  it("objednávka nalezená dvěma dotazy (podle účtu i e-mailu) se počítá jednou", () => {
    const paid = { id: "a", payment_collections: [{ status: "completed" }] }
    expect(paidOrderCount([paid, paid, { id: "b", payment_collections: [{ status: "completed" }] }, null])).toBe(2)
  })
})

describe("výběr zákazníků pro automat", () => {
  const base: AutoLoyaltyInput = {
    settings: { ...LOYALTY_CODE_DEFAULTS, auto_enabled: true },
    testMode: false,
    registered: true,
    email: "jana@example.com",
    newsletterEligible: true,
    paidOrders: 3,
    alreadyIssued: false,
  }

  it("pošle registrovanému odběrateli na 3. zaplacené objednávce", () => {
    expect(decideAutomaticLoyaltyCode(base)).toEqual({ send: true, reason: null })
  })

  it.each([
    [{ settings: { ...LOYALTY_CODE_DEFAULTS } }, "disabled"],
    [{ testMode: true }, "test-mode"],
    [{ email: " " }, "no-email"],
    [{ registered: false }, "guest"],
    [{ paidOrders: 2 }, "not-yet"],
    [{ newsletterEligible: false }, "no-newsletter"],
    [{ alreadyIssued: true }, "already-issued"],
  ] as const)("nepošle: %o → %s", (override, reason) => {
    expect(decideAutomaticLoyaltyCode({ ...base, ...(override as Partial<AutoLoyaltyInput>) })).toEqual({
      send: false,
      reason,
    })
  })

  it("kdo už má víc objednávek, dostane kód u další (jednou — pak už existuje)", () => {
    expect(decideAutomaticLoyaltyCode({ ...base, paidOrders: 7 }).send).toBe(true)
    expect(decideAutomaticLoyaltyCode({ ...base, paidOrders: 8, alreadyIssued: true }).send).toBe(false)
  })
})

describe("ruční kód — kdy nejde poslat", () => {
  const person = {
    anchorId: "cus_A",
    customerIds: ["cus_A"],
    email: "jana@example.com",
    registered: true,
    name: "Jana",
    primary: {},
  }
  it("jen potvrzenému odběrateli newsletteru", () => {
    expect(manualBlockReason(person, { state: "confirmed", eligible: true })).toBeNull()
    expect(manualBlockReason(person, { state: "pending", eligible: false })).toMatch(/nepotvrdil/)
    expect(manualBlockReason(person, { state: "unsubscribed", eligible: false })).toMatch(/odhlásil/)
    expect(manualBlockReason(person, { state: null, eligible: false })).toMatch(/neodebírá/)
    expect(manualBlockReason({ ...person, email: null }, { state: null, eligible: false })).toMatch(/e-mail/)
  })
})

/** Modul akcí v paměti — unikátní kód i identifikátor kampaně jako v databázi. */
const fakePromotionModule = () => {
  const campaigns: any[] = []
  const created: any[] = []
  return {
    campaigns,
    created,
    listCampaigns: jest.fn(async (filters: any) =>
      campaigns.filter((campaign) => campaign.campaign_identifier === filters.campaign_identifier)
    ),
    createPromotions: jest.fn(async ([input]: any[]) => {
      if (campaigns.some((campaign) => campaign.campaign_identifier === input.campaign.campaign_identifier)) {
        throw new Error("Campaign with campaign_identifier already exists")
      }
      const campaign = {
        ...input.campaign,
        promotions: [{ code: input.code, status: input.status, application_method: input.application_method }],
      }
      campaigns.push(campaign)
      created.push(input)
      return [input]
    }),
  }
}

const containerWith = (services: Record<string, unknown>) =>
  ({
    resolve: (key: string) => {
      if (key in services) return services[key]
      if (key === ContainerRegistrationKeys.LOGGER) return { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
      throw new Error(`neznámá služba ${key}`)
    },
  }) as any

describe("idempotence automatického kódu", () => {
  const person = {
    anchorId: "cus_A",
    customerIds: ["cus_A", "cus_G"],
    email: "jana@example.com",
    registered: true,
    name: "Jana",
    primary: {},
  }

  it("druhý běh pro stejnou hranici nic nezaloží a vrátí tentýž kód", async () => {
    const promotions = fakePromotionModule()
    const container = containerWith({ [Modules.PROMOTION]: promotions })
    const first = await createLoyaltyCode(container, { person, percentage: 10, validDays: 60, afterOrders: 3 })
    const second = await createLoyaltyCode(container, { person, percentage: 15, validDays: 30, afterOrders: 3 })
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.code).toBe(first.code)
    expect(second.identifier).toBe("kz-kod-cus_A-po-3")
    expect(promotions.createPromotions).toHaveBeenCalledTimes(1)
    expect(promotions.created[0].rules[0].values).toEqual(["cus_A", "cus_G"])
  })

  it("souběh: když kampaň mezitím založil druhý běh, vrátí se jeho kód", async () => {
    const promotions = fakePromotionModule()
    // První dotaz „existuje?" ještě nic nenajde, zápis ale narazí na hotovou kampaň.
    promotions.listCampaigns.mockImplementationOnce(async () => [])
    promotions.campaigns.push({
      campaign_identifier: "kz-kod-cus_A-po-3",
      ends_at: new Date("2027-01-01"),
      promotions: [{ code: "DIKY-JINY22", status: "active", application_method: { value: 10 } }],
    })
    const container = containerWith({ [Modules.PROMOTION]: promotions })
    const result = await createLoyaltyCode(container, { person, percentage: 10, validDays: 60, afterOrders: 3 })
    expect(result).toMatchObject({ code: "DIKY-JINY22", created: false })
  })

  it("ruční kód je pokaždé nový", async () => {
    const promotions = fakePromotionModule()
    const container = containerWith({ [Modules.PROMOTION]: promotions })
    const a = await createLoyaltyCode(container, { person, percentage: 10, validDays: 60 })
    const b = await createLoyaltyCode(container, { person, percentage: 10, validDays: 60 })
    expect(a.code).not.toBe(b.code)
    expect(promotions.createPromotions).toHaveBeenCalledTimes(2)
    expect(a.identifier).toBe(`kz-kod-cus_A-${a.code}`)
  })
})

describe("člověk za záznamem zákazníka", () => {
  it("kotva je účet, pravidlo pustí všechny záznamy se stejným e-mailem", async () => {
    const records = [
      { id: "cus_G1", email: "jana@example.com", has_account: false, created_at: "2026-01-01" },
      { id: "cus_ACC", email: "jana@example.com", has_account: true, created_at: "2026-05-01", first_name: "Jana", last_name: "Nová" },
      { id: "cus_G2", email: "Jana@Example.com", has_account: false, created_at: "2026-09-01" },
    ]
    const customerModule = {
      listCustomers: jest.fn(async (filters: any) =>
        filters.id ? records.filter((record) => record.id === filters.id) : records
      ),
    }
    const person = await loadLoyaltyPerson(containerWith({ [Modules.CUSTOMER]: customerModule }), {
      customerId: "cus_G2",
    })
    expect(person).toMatchObject({
      anchorId: "cus_ACC",
      customerIds: ["cus_G1", "cus_ACC", "cus_G2"],
      email: "jana@example.com",
      registered: true,
      name: "Jana Nová",
    })
  })

  it("host bez účtu: kotva je nejstarší záznam", async () => {
    const records = [
      { id: "cus_G2", email: "petr@example.com", has_account: false, created_at: "2026-09-01" },
      { id: "cus_G1", email: "petr@example.com", has_account: false, created_at: "2026-01-01" },
    ]
    const customerModule = {
      listCustomers: jest.fn(async (filters: any) =>
        filters.id ? records.filter((record) => record.id === filters.id) : records
      ),
    }
    const person = await loadLoyaltyPerson(containerWith({ [Modules.CUSTOMER]: customerModule }), {
      email: "petr@example.com",
    })
    expect(person).toMatchObject({ anchorId: "cus_G1", registered: false })
  })
})
