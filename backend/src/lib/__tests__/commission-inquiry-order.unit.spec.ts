import {
  CreateInquiryOrderSchema,
  inquiryOrderIssueMessage,
  inquirySnapshotCollectionMetadata,
  pickShippingOption,
  planInquiryOrder,
  splitName,
} from "../commission-inquiry-order"
import { inquiryOrderOf, withInquiryOrder } from "../commission-inquiry-records"

const inquiry = {
  id: "noti_1",
  received_at: "2026-11-17T10:00:00.000Z",
  status: "new",
  name: "Jana Nováková",
  email: "jana@example.cz",
  phone: "+420777000111",
  description: "Domovní znamení s liškou",
  dimensions: "20 × 30 cm",
  motif: null,
  deadline: null,
  product_title: null,
  product_url: null,
  photo_urls: ["https://img.example/a.jpg", "https://img.example/b.jpg"],
  photos_failed: 0,
} as any

const pickup = { id: "so_pickup", name: "Osobní odběr v ateliéru", provider_id: "pickup_pickup", data: {} }
const post = {
  id: "so_post",
  name: "Česká pošta — na adresu",
  provider_id: "ceska-posta_ceska-posta",
  data: { id: "cp-address", rates: { small: 95, large: 140, fragile: 55, poukaz: 95 } },
}
const balikovna = { id: "so_box", name: "Balíkovna", provider_id: "ceska-posta_ceska-posta", data: { id: "balikovna" } }

const form = (extra: Record<string, unknown> = {}) =>
  CreateInquiryOrderSchema.parse({
    title: "Domovní znamení",
    brief: "Liška, 20 × 30 cm",
    price: 2400,
    delivery: "pickup",
    ...extra,
  })

describe("objednávka z poptávky", () => {
  it("doprava: odběr, nebo Česká pošta na adresu (ne Balíkovna)", () => {
    expect(pickShippingOption([balikovna, post, pickup], "pickup")?.id).toBe("so_pickup")
    expect(pickShippingOption([balikovna, pickup, post], "post")?.id).toBe("so_post")
    expect(pickShippingOption([balikovna, pickup], "post")).toBeNull()
  })

  it("řádek zakázky za 0 Kč s cenou po domluvě, zadáním a fotkami z poptávky", () => {
    const plan = planInquiryOrder({ inquiry, form: form(), shippingOption: pickup })
    expect(plan.email).toBe("jana@example.cz")
    expect(plan.address).toMatchObject({ first_name: "Jana", last_name: "Nováková", country_code: "cz" })
    expect(plan.item).toMatchObject({ title: "Domovní znamení", quantity: 1, unit_price: 0 })
    expect(plan.item.metadata).toMatchObject({
      made_to_order: { specification: "Liška, 20 × 30 cm", photos: inquiry.photo_urls },
      price_on_request: true,
      commission_inquiry_id: "noti_1",
    })
    expect(plan.shipping_method).toMatchObject({ shipping_option_id: "so_pickup", amount: 0 })
    expect(plan.personal_pickup).toBe(true)
  })

  it("cena + odkaz = domluvená cena se zálohou; odběr bez poštovného", () => {
    const plan = planInquiryOrder({
      inquiry,
      form: form({ deposit_percentage: 30 }),
      shippingOption: pickup,
    })
    expect(plan.agreed_price).toEqual({
      price: 2400,
      deposit_percentage: 30,
      deposit_amount: 720,
      shipping_total: 0,
      packaging_total: 0,
    })
    expect(plan.internal_note).toBeNull()
  })

  it("pošta: poštovné z ceníku (malá + křehká), adresa v plánu", () => {
    const plan = planInquiryOrder({
      inquiry,
      form: form({
        delivery: "post",
        address: { address_1: "Testovací 12", city: "Písek", postal_code: "39701" },
        parcel_size: "male",
        fragile: true,
      }),
      shippingOption: post,
    })
    expect(plan.address).toMatchObject({ address_1: "Testovací 12", city: "Písek", postal_code: "397 01" })
    expect(plan.agreed_price?.shipping_total).toBe(150)
  })

  it("cena bez odeslání = jen poznámka u zakázky; cena 0 = nic", () => {
    const silent = planInquiryOrder({
      inquiry,
      form: form({ send_payment_link: false }),
      shippingOption: pickup,
    })
    expect(silent.agreed_price).toBeNull()
    expect(silent.internal_note).toMatch(/2[\s  ]400 Kč/)
    const later = planInquiryOrder({ inquiry, form: form({ price: 0 }), shippingOption: pickup })
    expect(later.agreed_price).toBeNull()
    expect(later.internal_note).toBeNull()
  })

  it("cizí fotku formulář nepodstrčí", () => {
    const plan = planInquiryOrder({
      inquiry,
      form: form({ photo_urls: ["https://evil.example/x.jpg", "https://img.example/a.jpg"] }),
      shippingOption: pickup,
    })
    expect(plan.photos).toEqual(["https://img.example/a.jpg"])
  })

  it("pošta bez adresy neprojde a hláška je česky", () => {
    const parsed = CreateInquiryOrderSchema.safeParse({
      title: "X",
      brief: "Y",
      price: 0,
      delivery: "post",
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(inquiryOrderIssueMessage(parsed.error)).toContain("adresu")
  })

  it("snímková kolekce nese zakázkový řádek objednávky", () => {
    const metadata = inquirySnapshotCollectionMetadata({
      lineItemId: "ordli_1",
      depositPercentage: 25,
      specification: "Liška",
      inquiryId: "noti_1",
    }) as any
    expect(metadata.made_to_order).toBe(true)
    expect(metadata.production_lines[0]).toMatchObject({
      line_item_id: "ordli_1",
      line_total: 0,
      contract_deposit_percentage: 25,
    })
  })

  it("poptávka si pamatuje objednávku a je vyřízená", () => {
    const data = withInquiryOrder({ title: "Poptávka" }, {
      order_id: "order_1",
      display_id: 80,
      created_at: "2026-11-17T10:00:00.000Z",
    })
    expect(data.inquiry_status).toBe("done")
    expect(inquiryOrderOf(data)).toMatchObject({ order_id: "order_1", display_id: 80 })
    expect(inquiryOrderOf({})).toBeNull()
  })

  it("jméno se rozdělí na křestní a příjmení", () => {
    expect(splitName("Jana Nováková")).toEqual({ first_name: "Jana", last_name: "Nováková" })
    expect(splitName("Jana")).toEqual({ first_name: "Jana", last_name: "" })
  })
})
