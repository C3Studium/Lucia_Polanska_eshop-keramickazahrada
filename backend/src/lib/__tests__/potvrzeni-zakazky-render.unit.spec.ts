import { writeFileSync } from "node:fs"
import { confirmationFieldsFor } from "../potvrzeni-zakazky/fields"
import { generateCommissionConfirmationPdf } from "../potvrzeni-zakazky/pdf"

/**
 * Pomocný render do souboru pro vizuální kontrolu (spouští se jen s
 * POTVRZENI_RENDER_OUT=<cesta>.pdf) — v běžné sadě se přeskočí.
 */
const out = process.env.POTVRZENI_RENDER_OUT

;(out ? describe : describe.skip)("render potvrzení zakázky", () => {
  it("writes the PDF", async () => {
    const { fields } = confirmationFieldsFor({
      order: {
        id: "order_01",
        display_id: 1234,
        email: "jana.novakova@example.cz",
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
        billing_address: { first_name: "Jana", last_name: "Nováková", address_1: "Dlouhá 12", postal_code: "110 00", city: "Praha 1", phone: "+420 600 000 000" },
        shipping_methods: [{ name: "Balíkovna", total: 99 }],
        items: [
          {
            id: "item_1",
            product_title: "Domovní číslo z kameniny",
            variant_title: "Modrá glazura",
            product_id: "prod_1",
            variant_id: "var_1",
            quantity: 1,
            total: 2400,
            metadata: { made_to_order: { specification: "Číslo 229, modrá glazura, kulaté rohy. Písmo jako na fotce, výška asi 20 cm.\nDruhý řádek: ulice Putimská.", photos: ["https://img.example.cz/a.jpg", "https://img.example.cz/b.png"] } },
          },
          { id: "item_pack", title: "Balné — Domovní číslo", total: 80, metadata: { packaging_fee: true } },
        ],
        payment_collections: [
          { amount: 600, status: "authorized", metadata: { made_to_order: true, production_lines: [{}], original_cart_total: 2579 }, payments: [{ id: "p" }], payment_sessions: [{ provider_id: "pp_comgate_comgate", status: "authorized" }] },
        ],
      },
      productionOrder: {
        id: "po_1",
        created_at: "2026-10-20T12:05:03.000Z",
        deposit_percentage: 25,
        deposit_amount: 600,
        currency_code: "czk",
        customer_note: "Číslo 229, modrá glazura, kulaté rohy. Písmo jako na fotce, výška asi 20 cm.\nDruhý řádek: ulice Putimská.",
        payment_requests: [{ type: "deposit", status: "paid", amount: 600, paid_at: "2026-10-20T12:04:58.000Z" }],
      },
      profile: { production_time_min_days: 14, production_time_max_days: 42 },
      facts: {
        "seller.name": "Lucie Polanská",
        "seller.address": "Putim 229, 397 01 Písek",
        "seller.ico": "03441482",
        "seller.email": "info@keramickazahrada.cz",
        "seller.phone": "+420 775 211 578",
        "vat.status": "nejsme plátci DPH",
      } as any,
    })
    fields.links.complaints = "https://keramickazahrada.cz/cz/reklamacni-rad"
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64"
    )
    const bytes = await generateCommissionConfirmationPdf(fields, {
      fetchImage: async (url) => (url.endsWith(".png") ? new Uint8Array(png) : null),
    })
    writeFileSync(out as string, bytes)
  }, 30_000)
})
