import { createHash } from "node:crypto"
import { PDFDocument } from "pdf-lib"
import type { LegalManifest } from "../legal"
import {
  briefPhotosOf,
  confirmationFieldsFor,
  formatCzechDateTime,
  formatCzechMoney,
  isCommissionCheckoutOrder,
  NEUVEDENO,
  vatNoteFor,
  type CommissionConfirmationInput,
} from "../potvrzeni-zakazky/fields"
import { generateCommissionConfirmationPdf } from "../potvrzeni-zakazky/pdf"
import {
  confirmationKeyFor,
  confirmationVersionKeyFor,
  planConfirmationStorage,
  sha256Hex,
  storeCommissionConfirmation,
} from "../potvrzeni-zakazky/store"
import { withCommissionConfirmation } from "../legal/order-legal"
import { consentReady } from "../../subscribers/commission-confirmation"

/**
 * PDF „Potvrzení zakázky" (LEGAL_AUDIT § 0, Z11): mapování bez vymyšlených
 * hodnot, deterministické bajty (neměnný doklad), uložení bez přepsání.
 */

const manifest: LegalManifest = {
  schema: 1,
  seller: {
    name: "Lucie Polanská",
    address: "Putim 229, 397 01 Písek",
    ico: "03441482",
    email: "info@keramickazahrada.cz",
    phone: "+420 775 211 578",
    web: "keramickazahrada.cz",
    webUrl: "https://keramickazahrada.cz",
  },
  documents: {
    "obchodni-podminky": {
      title: "Obchodní podmínky",
      path: "/smluvni-podminky",
      versions: [
        { version: "2026-10-15", effectiveFrom: "2026-10-15", title: "Obchodní podmínky", archived: false, pdf: null },
      ],
    },
    "reklamacni-rad": { title: "Reklamační řád", path: "/reklamacni-rad", versions: [] },
  },
}

const facts = {
  "seller.name": "Lucie Polanská",
  "seller.address": "Putim 229, 397 01 Písek",
  "seller.ico": "03441482",
  "seller.email": "info@keramickazahrada.cz",
  "seller.phone": "+420 775 211 578",
  "vat.status": "nejsme plátci DPH",
} as any

const order = {
  id: "order_01",
  display_id: 1234,
  email: "jana@example.cz",
  created_at: "2026-10-20T12:05:00.000Z",
  currency_code: "czk",
  total: 2579,
  shipping_total: 99,
  metadata: {
    terms_version: "2026-10-15",
    terms_accepted_at: "2026-10-20T12:04:50.000Z",
    terms_recorded_at: "2026-10-20T12:05:01.000Z",
    made_to_order_ack_at: "2026-10-20T12:04:50.000Z",
  },
  customer: { first_name: "Jana", last_name: "Nováková", phone: "+420 600 000 000" },
  billing_address: {
    first_name: "Jana",
    last_name: "Nováková",
    address_1: "Dlouhá 12",
    postal_code: "110 00",
    city: "Praha 1",
    phone: "+420 600 000 000",
  },
  shipping_methods: [{ name: "Balíkovna", total: 99 }],
  items: [
    {
      id: "item_1",
      title: "Domovní číslo",
      product_title: "Domovní číslo z kameniny",
      variant_title: "Modrá glazura",
      product_id: "prod_1",
      variant_id: "var_1",
      quantity: 1,
      total: 2400,
      metadata: {
        made_to_order: {
          specification: "Číslo 229, modrá glazura,\nkulaté rohy.",
          photos: ["https://img.example.cz/foto-1.jpg", "https://img.example.cz/foto-2.png"],
        },
      },
    },
    {
      id: "item_pack",
      title: "Balné — Domovní číslo",
      total: 80,
      metadata: { packaging_fee: true },
    },
  ],
  payment_collections: [
    {
      amount: 600,
      status: "authorized",
      metadata: { made_to_order: true, production_lines: [{ line_item_id: "item_1" }], original_cart_total: 2579 },
      payments: [{ id: "pay_1" }],
      payment_sessions: [{ provider_id: "pp_comgate_comgate", status: "authorized" }],
    },
  ],
}

const productionOrder = {
  id: "po_1",
  created_at: "2026-10-20T12:05:03.000Z",
  deposit_percentage: 25,
  deposit_amount: 600,
  original_total: 2579,
  currency_code: "czk",
  customer_note: "Číslo 229, modrá glazura,\nkulaté rohy.",
  payment_requests: [
    { type: "deposit", status: "paid", amount: 600, paid_at: "2026-10-20T12:04:58.000Z", selected_method: "CARD_CZ_CSOB_2" },
  ],
}

const profile = { production_time_min_days: 14, production_time_max_days: 42 }

const flatten = (value: unknown): string[] => {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(flatten)
  if (value && typeof value === "object") return Object.values(value).flatMap(flatten)
  return []
}

describe("confirmationFieldsFor", () => {
  it("maps every template placeholder from real data — nothing is invented", () => {
    const { fields, warnings } = confirmationFieldsFor({ order, productionOrder, profile, facts, manifest })
    expect(warnings).toEqual([])
    expect(flatten(fields).some((text) => text.includes("{{"))).toBe(false)
    expect(fields.order.number).toBe("#1234")
    expect(fields.order.placed_at).toBe("20. 10. 2026 14:05")
    expect(fields.order.confirmed_at).toBe("20. 10. 2026 14:05")
    expect(fields.terms.version).toBe("15. 10. 2026")
    expect(fields.terms.version_raw).toBe("2026-10-15")
    expect(fields.seller.name).toBe("Lucie Polanská")
    expect(fields.customer).toEqual({
      name: "Jana Nováková",
      address: "Dlouhá 12, 110 00 Praha 1",
      email: "jana@example.cz",
      phone: "+420 600 000 000",
    })
    expect(fields.product).toEqual({ title: "Domovní číslo z kameniny", variant_suffix: " — Modrá glazura" })
    expect(fields.brief.text).toBe("Číslo 229, modrá glazura,\nkulaté rohy.")
    expect(fields.brief.photos).toEqual(["https://img.example.cz/foto-1.jpg", "https://img.example.cz/foto-2.png"])
    expect(fields.shipping.method).toBe("Balíkovna")
    expect(fields.price).toEqual({
      currency: "Kč",
      item: "2 400,00",
      other: null,
      // doprava 99 + balné 80
      shipping: "179,00",
      total: "2 579,00",
      paid: "600,00",
      deposit: "600,00",
      balance: "1 979,00",
    })
    expect(fields.deposit).toEqual({ method: "online přes platební bránu ComGate", paid_at: "20. 10. 2026 14:04" })
    expect(fields.mto).toEqual({ deposit: "25", lead_time_min: "14", lead_time_max: "42" })
    expect(fields.vat.note).toBe(", nejsme plátci DPH")
    // Serverové razítko platí pro oba souhlasy.
    expect(fields.consent).toEqual({ terms_at: "20. 10. 2026 14:05", mto_at: "20. 10. 2026 14:05" })
  })

  it(`says „neuvedeno" for everything that is missing, and warns`, () => {
    const { fields, warnings } = confirmationFieldsFor({
      order: { id: "order_02", display_id: 2, items: [], metadata: {} },
      productionOrder: { id: "po_2", deposit_percentage: null, deposit_amount: null },
      profile: null,
      facts: null,
      manifest,
    })
    expect(flatten(fields).some((text) => text.includes("{{"))).toBe(false)
    expect(fields.seller.name).toBe(NEUVEDENO)
    expect(fields.customer.name).toBe(NEUVEDENO)
    expect(fields.customer.address).toBe(NEUVEDENO)
    expect(fields.product.title).toBe(NEUVEDENO)
    expect(fields.brief.text).toBe(NEUVEDENO)
    expect(fields.shipping.method).toBe(NEUVEDENO)
    expect(fields.price.deposit).toBe(NEUVEDENO)
    expect(fields.deposit.paid_at).toBe(NEUVEDENO)
    expect(fields.mto.lead_time_max).toBe(NEUVEDENO)
    expect(fields.consent.terms_at).toBe(NEUVEDENO)
    expect(fields.consent.mto_at).toBe(NEUVEDENO)
    expect(fields.order.confirmed_at).toBe(NEUVEDENO)
    // DPH chybí → žádná věta, ale varování do logu.
    expect(fields.vat.note).toBe("")
    expect(warnings.some((warning) => warning.includes("vat.status"))).toBe(true)
  })

  it("derives the contractual deposit from the percentage on older commissions", () => {
    const { fields } = confirmationFieldsFor({
      order,
      productionOrder: { ...productionOrder, deposit_amount: null, deposit_percentage: 50 },
      profile,
      facts,
      manifest,
    })
    expect(fields.price.deposit).toBe("1 200,00")
    expect(fields.mto.deposit).toBe("50")
  })

  it(`keeps a mixed cart honest: commission price plus „další zboží" adds up to the total`, () => {
    const mixed = {
      ...order,
      total: 2979,
      items: [...order.items, { id: "item_3", title: "Hrnek", product_title: "Hrnek", total: 400, product_id: "prod_2", variant_id: "var_2", metadata: {} }],
    }
    const { fields } = confirmationFieldsFor({ order: mixed, productionOrder, profile, facts, manifest })
    expect(fields.price.item).toBe("2 400,00")
    expect(fields.price.other).toBe("400,00")
    expect(fields.price.total).toBe("2 979,00")
  })

  it("vatNoteFor reads the fact as ne/ano/empty", () => {
    expect(vatNoteFor("nejsme plátci DPH").note).toBe(", nejsme plátci DPH")
    expect(vatNoteFor("Ano, jsme plátci DPH").note).toBe(" včetně DPH")
    expect(vatNoteFor(null)).toEqual({ note: "", warning: expect.stringContaining("vat.status") })
    expect(vatNoteFor("možná").note).toBe("")
  })

  it("collects at most three https photos from items and the customer's diary, without duplicates", () => {
    expect(
      briefPhotosOf(
        [{ metadata: { made_to_order: { photos: ["https://a/1.jpg", "http://a/x.jpg", "https://a/1.jpg"] } } }] as any,
        [
          { created_by: "customer", images: ["https://a/2.jpg", "https://a/3.jpg", "https://a/4.jpg"] },
          { created_by: "merchant", images: ["https://a/9.jpg"] },
        ]
      )
    ).toEqual(["https://a/1.jpg", "https://a/2.jpg", "https://a/3.jpg"])
  })

  it("formats money and dates the Czech way", () => {
    expect(formatCzechMoney(1234.5)).toBe("1 234,50")
    expect(formatCzechMoney({ value: "12" })).toBe("12,00")
    expect(formatCzechDateTime("2026-10-20T12:05:00.000Z")).toBe("20. 10. 2026 14:05")
    expect(formatCzechDateTime("nesmysl")).toBe(NEUVEDENO)
  })

  it("recognises a commission checkout only by the checkout collection (same rule as production orders)", () => {
    expect(isCommissionCheckoutOrder(order)).toBe(true)
    expect(isCommissionCheckoutOrder({ payment_collections: [{ metadata: { made_to_order: true, production_lines: [] } }] })).toBe(false)
    expect(isCommissionCheckoutOrder({ payment_collections: [] })).toBe(false)
    expect(isCommissionCheckoutOrder(null)).toBe(false)
  })
})

describe("generateCommissionConfirmationPdf", () => {
  const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
  let fields: CommissionConfirmationInput

  beforeAll(() => {
    fields = confirmationFieldsFor({ order, productionOrder, profile, facts, manifest }).fields
    fields.links.complaints = "https://keramickazahrada.cz/cz/reklamacni-rad"
  })

  it("is deterministic — same input, same bytes, same sha256", async () => {
    const first = await generateCommissionConfirmationPdf(fields)
    const second = await generateCommissionConfirmationPdf(fields)
    expect(sha(first)).toBe(sha(second))
    expect(first.length).toBeGreaterThan(10_000)
  }, 30_000)

  it("renders two A4 pages with the order's date as the document date and fixed producer", async () => {
    const bytes = await generateCommissionConfirmationPdf(fields)
    const doc = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getCreationDate()?.toISOString()).toBe("2026-10-20T12:05:00.000Z")
    expect(doc.getModificationDate()?.toISOString()).toBe("2026-10-20T12:05:00.000Z")
    expect(doc.getTitle()).toBe("Potvrzení zakázky č. #1234")
    expect(doc.getProducer()).toBe("Keramická zahrada — e-shop")
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()]
    expect(Math.round(w)).toBe(595)
    expect(Math.round(h)).toBe(842)
  }, 30_000)

  it(`still fits two pages with everything „neuvedeno" and a long brief`, async () => {
    const sparse = confirmationFieldsFor({
      order: { id: "o", display_id: 7, items: [], metadata: {} },
      productionOrder: { id: "po", customer_note: "Řádek zadání.\n".repeat(12) },
      profile: null,
      facts: null,
      manifest,
    }).fields
    const doc = await PDFDocument.load(await generateCommissionConfirmationPdf(sparse), { updateMetadata: false })
    expect(doc.getPageCount()).toBe(2)
  }, 30_000)

  it("embeds JPEG/PNG photos as thumbnails and falls back to a frame for anything else", async () => {
    // Nejmenší platný PNG (1×1) — ověří cestu embedPng; JPEG se tu nefalšuje.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64"
    )
    const fetchImage = async (url: string) =>
      url.endsWith(".png") ? new Uint8Array(png) : url.endsWith(".jpg") ? new Uint8Array([1, 2, 3, 4]) : null
    const withPhotos = await generateCommissionConfirmationPdf(fields, { fetchImage })
    const again = await generateCommissionConfirmationPdf(fields, { fetchImage })
    expect(sha(withPhotos)).toBe(sha(again))
    const doc = await PDFDocument.load(withPhotos, { updateMetadata: false })
    expect(doc.getPageCount()).toBe(2)
    expect(Buffer.from(withPhotos).toString("latin1")).toContain("/Image")
  }, 30_000)
})

describe("storage plan (immutability)", () => {
  it("reuses the stored file when the hash matches, uploads to the fixed key when nothing is there, and never overwrites", () => {
    const sha256 = "a".repeat(64)
    expect(planConfirmationStorage({ orderId: "o1", sha256, previous: { key: "orders/o1/potvrzeni-zakazky.pdf", sha256 }, fixedKeyExists: true })).toEqual({
      action: "reuse",
      key: "orders/o1/potvrzeni-zakazky.pdf",
    })
    expect(planConfirmationStorage({ orderId: "o1", sha256, previous: null, fixedKeyExists: false })).toEqual({
      action: "upload",
      key: confirmationKeyFor("o1"),
    })
    expect(planConfirmationStorage({ orderId: "o1", sha256, previous: { sha256: "b".repeat(64) }, fixedKeyExists: true })).toEqual({
      action: "upload",
      key: confirmationVersionKeyFor("o1", sha256),
    })
    expect(confirmationVersionKeyFor("o1", sha256)).toBe("orders/o1/potvrzeni-zakazky-aaaaaaaa.pdf")
  })

  it("storeCommissionConfirmation talks to the fixed-key provider and skips the upload for an unchanged PDF", async () => {
    const put = jest.fn(async (key: string) => ({ key, url: `https://img.example.cz/${key}` }))
    const existing = new Set<string>()
    const provider = {
      putObjectAtKey: put,
      objectExistsAtKey: async (key: string) => existing.has(key),
      publicUrlForKey: (key: string) => `https://img.example.cz/${key}`,
    }
    const container = {
      resolve: (key: string) =>
        key === "file"
          ? { getProvider: () => ({ fileProvider_: provider }) }
          : { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
    } as any
    const bytes = new Uint8Array([1, 2, 3])
    const first = await storeCommissionConfirmation(container, "o1", bytes, null)
    expect(first).toEqual({
      key: "orders/o1/potvrzeni-zakazky.pdf",
      url: "https://img.example.cz/orders/o1/potvrzeni-zakazky.pdf",
      sha256: sha256Hex(bytes),
      uploaded: true,
    })
    existing.add(first.key)

    const same = await storeCommissionConfirmation(container, "o1", bytes, first)
    expect(same.uploaded).toBe(false)
    expect(put).toHaveBeenCalledTimes(1)

    const changed = await storeCommissionConfirmation(container, "o1", new Uint8Array([9, 9]), first)
    expect(changed.uploaded).toBe(true)
    expect(changed.key).toBe(`orders/o1/potvrzeni-zakazky-${changed.sha256.slice(0, 8)}.pdf`)
    expect(put).toHaveBeenLastCalledWith(changed.key, expect.anything(), "application/pdf")
  })
})

describe("e-mail wiring", () => {
  it("withCommissionConfirmation marks the attachment only when it was reachable", () => {
    const legal = { terms: null, withdrawal: null } as any
    const attachment = { filename: "Potvrzeni-zakazky-1234.pdf", url: "https://img.example.cz/orders/o1/potvrzeni-zakazky.pdf" }
    expect(withCommissionConfirmation(legal, attachment, [attachment]).commission_confirmation).toEqual({ ...attachment, attached: true })
    expect(withCommissionConfirmation(legal, attachment, []).commission_confirmation).toEqual({ ...attachment, attached: false })
    expect(withCommissionConfirmation(legal, null, []).commission_confirmation).toBeNull()
  })

  it("consentReady waits for both consents and the server stamp", () => {
    expect(consentReady({ terms_accepted_at: "x", made_to_order_ack_at: "y", terms_recorded_at: "z" })).toBe(true)
    expect(consentReady({ terms_accepted_at: "x", made_to_order_ack_at: "y" })).toBe(false)
    expect(consentReady({ terms_accepted_at: "x", made_to_order_ack_at: "", terms_recorded_at: "z" })).toBe(false)
    expect(consentReady(null)).toBe(false)
  })
})
