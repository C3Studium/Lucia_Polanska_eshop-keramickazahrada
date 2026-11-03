import { buildInquiryOwnerNotification, CommissionInquirySchema } from "../commission-inquiry"
import {
  attachStoredInquiry,
  baseInquiryKey,
  buildStoredInquiry,
  collectInquiries,
  countInquiries,
  inquiryFromNotification,
  isInquiryStatus,
  parseOwnerDescription,
  setInquiryStatus,
  withInquiryStatus,
  withStoredInquiry,
} from "../commission-inquiry-records"

/**
 * Poptávky v adminu: údaje z položky zvonku (nové `data.inquiry`, staré
 * z textu upozornění), stav a jeho uložení do notifikace.
 */

const receivedAt = new Date("2026-10-14T13:32:10.000Z")
const context = {
  receivedAt,
  photoUrls: ["https://img.example/poptavka-1.jpg", "https://img.example/poptavka-2.jpg"],
  photosFailed: 1,
}
const input = CommissionInquirySchema.parse({
  description: "Domovní číslo 229.\n\nRozměry: tohle píše zákazník, ne formulář.\nA ještě řádek.",
  dimensions: "30 × 20 cm",
  motif: "229",
  deadline: "do Vánoc",
  name: " Jana Nováková ",
  email: " jana@example.cz ",
  phone: "+420 603 123 456",
  terms_accepted: true,
  terms_version: "2026-10-15",
  product_handle: "cedulka",
  product_title: "Cedulka s číslem",
})

/** Položka zvonku, jak ji zakládá `notifyMerchant` (`buildFeedNotification`). */
const feedOf = (
  owner: ReturnType<typeof buildInquiryOwnerNotification>,
  extra: Record<string, unknown> = {},
  id = "noti_1",
  created_at = receivedAt.toISOString()
) => ({
  id,
  created_at,
  idempotency_key: owner.key,
  data: { title: owner.title, description: owner.description, ...extra },
})

describe("staré poptávky — čtení z textu upozornění", () => {
  const OLD_ENV = { ...process.env }
  const setStorefront = (url: string) => {
    process.env.STOREFRONT_PUBLIC_URL = url
    delete process.env.MEDUSA_STOREFRONT_URL
    delete process.env.STOREFRONT_COUNTRY
  }
  afterAll(() => {
    process.env = OLD_ENV
  })

  it("text, který skládá buildInquiryOwnerNotification, se přečte celý zpátky", () => {
    setStorefront("https://obchod.example")
    const owner = buildInquiryOwnerNotification(input, context)
    const parsed = parseOwnerDescription(owner.description)
    expect(parsed).toEqual({
      name: "Jana Nováková",
      email: "jana@example.cz",
      phone: "+420 603 123 456",
      // Víceřádkový popis i se „Rozměry:" uvnitř zůstane celý.
      description: "Domovní číslo 229.\n\nRozměry: tohle píše zákazník, ne formulář.\nA ještě řádek.",
      dimensions: "30 × 20 cm",
      motif: "229",
      deadline: "do Vánoc",
      product_title: "Cedulka s číslem",
      product_url: "https://obchod.example/cz/products/cedulka",
      photo_urls: context.photoUrls,
      photos_failed: 1,
    })
  })

  it("prázdná pole = null, žádné fotky = prázdný seznam, výrobek bez odkazu", () => {
    setStorefront("")
    const minimal = CommissionInquirySchema.parse({
      description: "Reliéf",
      name: "Jana",
      email: "jana@example.cz",
      terms_accepted: true,
    })
    const owner = buildInquiryOwnerNotification(minimal, { receivedAt, photoUrls: [], photosFailed: 0 })
    expect(parseOwnerDescription(owner.description)).toMatchObject({
      phone: null,
      dimensions: null,
      motif: null,
      deadline: null,
      product_title: null,
      product_url: null,
      photo_urls: [],
      photos_failed: 0,
    })
  })

  it("skutečná položka zvonku (sandbox, 3. 11. 2026) se přečte", () => {
    const record = inquiryFromNotification({
      id: "noti_01M6GFD83S7BNQ6CFNYRSVFX13",
      created_at: "2026-11-03T10:31:19.930Z",
      idempotency_key: "mn:commission-inquiry:a2e9724771896a531d7daea867453450e28836a0",
      data: {
        title: "Poptávka zakázky — Test Poptávka",
        description:
          "Nová poptávka zakázky ze stránky Výroba. Odpovědí na tento e-mail píšete rovnou zákazníkovi.\n\nOd: Test Poptávka <poptavka-test@example.com>\nTelefon: +420 600 000 000\n\nK výrobku: Testovací výrobek — http://localhost:8100/cz/products/test-vyrobek\n\nCo si představuje:\nTEST (agent poptávky) — domovní číslo 12 s vlaštovkou.\n\nDruhý odstavec.\n\nRozměry: 30 × 20 cm\nMotiv / text / číslo: 12\nTermín: nespěchá\n\nFotografie místa (1):\nhttp://localhost:9100/static/1793701879924-poptavka-misto.png\n\nSouhlas s obchodními podmínkami: ano — verze 2026-11-03 (účinná od 3. 11. 2026), udělen 3. 11. 2026 11:31:19 (čas serveru, Praha; 2026-11-03T10:31:19.923Z).\n\nDalší krok: nabídka s cenou, dodací lhůtou a výší zálohy a s poučením, že zakázku vyrobenou podle zadání nelze vrátit ve 14denní lhůtě (§ 1837 písm. d) OZ).",
      },
    })
    expect(record).toEqual({
      id: "noti_01M6GFD83S7BNQ6CFNYRSVFX13",
      received_at: "2026-11-03T10:31:19.930Z",
      status: "new",
      name: "Test Poptávka",
      email: "poptavka-test@example.com",
      phone: "+420 600 000 000",
      description: "TEST (agent poptávky) — domovní číslo 12 s vlaštovkou.\n\nDruhý odstavec.",
      dimensions: "30 × 20 cm",
      motif: "12",
      deadline: "nespěchá",
      product_title: "Testovací výrobek",
      product_url: "http://localhost:8100/cz/products/test-vyrobek",
      photo_urls: ["http://localhost:9100/static/1793701879924-poptavka-misto.png"],
      photos_failed: 0,
    })
  })

  it("text, který poptávkou není, se nevymýšlí", () => {
    expect(parseOwnerDescription("Nová zaplacená objednávka #12")).toBeNull()
    expect(parseOwnerDescription(undefined)).toBeNull()
    expect(inquiryFromNotification({ id: "noti_x", data: { title: "Něco jiného" } })).toBeNull()
  })
})

describe("nové poptávky — data.inquiry", () => {
  it("uložená pole mají přednost před textem a výrobek dostane odkaz z handle", () => {
    const owner = buildInquiryOwnerNotification(input, context)
    const stored = buildStoredInquiry(input, context)
    expect(stored).toMatchObject({
      name: "Jana Nováková",
      email: "jana@example.cz",
      received_at: "2026-10-14T13:32:10.000Z",
      product_handle: "cedulka",
      photos_failed: 1,
    })
    const record = inquiryFromNotification(
      feedOf(owner, { inquiry: { ...stored, description: "Z uložených polí" } })
    )
    expect(record?.description).toBe("Z uložených polí")
    expect(record?.status).toBe("new")
    expect(record?.photo_urls).toEqual(context.photoUrls)
  })

  it("dopsání údajů ani změna stavu nesmaže titulek a text zvonku", () => {
    const owner = buildInquiryOwnerNotification(input, context)
    const data = feedOf(owner).data
    const withStatus = withInquiryStatus(data, "answered")
    expect(withStatus).toMatchObject({ title: owner.title, description: owner.description, inquiry_status: "answered" })
    const withData = withStoredInquiry(withStatus, buildStoredInquiry(input, context))
    expect(withData.inquiry_status).toBe("answered")
    expect(withData.title).toBe(owner.title)
  })
})

describe("stav a seznam", () => {
  it("jen tři stavy; neznámý = Nová", () => {
    expect(["new", "answered", "done"].every(isInquiryStatus)).toBe(true)
    expect(isInquiryStatus("archived")).toBe(false)
    const owner = buildInquiryOwnerNotification(input, context)
    expect(inquiryFromNotification(feedOf(owner, { inquiry_status: "nesmysl" }))?.status).toBe("new")
    expect(inquiryFromNotification(feedOf(owner, { inquiry_status: "done" }))?.status).toBe("done")
  })

  it("nejnovější nahoře, opakované odeslání (:r2) jen jednou, počty po stavech", () => {
    const first = buildInquiryOwnerNotification(input, context)
    const later = buildInquiryOwnerNotification(
      { ...input, description: "Váza" },
      { ...context, receivedAt: new Date("2026-10-20T10:00:00.000Z") }
    )
    const records = collectInquiries([
      feedOf(first, { inquiry_status: "done" }, "noti_a", "2026-10-14T13:32:10.000Z"),
      { ...feedOf(first, {}, "noti_retry", "2026-10-14T13:40:00.000Z"), idempotency_key: `${first.key}:r2` },
      feedOf(later, {}, "noti_b", "2026-10-20T10:00:00.000Z"),
      { id: "noti_junk", created_at: "2026-10-25T10:00:00.000Z", idempotency_key: "mn:x", data: {} },
    ])
    expect(records.map((record) => record.id)).toEqual(["noti_b", "noti_a"])
    expect(countInquiries(records)).toEqual({ new: 1, answered: 0, done: 1 })
    expect(baseInquiryKey(`${first.key}:r12`)).toBe(first.key)
  })
})

describe("zápis do notifikačního modulu", () => {
  const owner = buildInquiryOwnerNotification(input, context)

  const containerWith = (rows: any[]) => {
    const updates: any[] = []
    const listCalls: any[] = []
    const module = {
      listNotifications: jest.fn(async (filters: any, config: any) => {
        listCalls.push({ filters, config })
        return rows.filter(
          (row) =>
            (!filters.id || row.id === filters.id) &&
            (!filters.idempotency_key || row.idempotency_key === filters.idempotency_key)
        )
      }),
      updateNotifications: jest.fn(async (data: any) => {
        updates.push(data)
        return data
      }),
    }
    return { container: { resolve: () => module } as any, updates, listCalls }
  }

  it("změna stavu hledá jen položky zvonku poptávek a zapíše celá data", async () => {
    const { container, updates, listCalls } = containerWith([feedOf(owner)])
    const record = await setInquiryStatus(container, "noti_1", "answered")
    expect(record?.status).toBe("answered")
    expect(listCalls[0].filters).toMatchObject({ id: "noti_1", channel: "feed", trigger_type: "commission-inquiry" })
    expect(updates).toEqual([
      { id: "noti_1", data: expect.objectContaining({ title: owner.title, inquiry_status: "answered" }) },
    ])
  })

  it("neexistující poptávka = null, nic se nezapíše", async () => {
    const { container, updates } = containerWith([])
    expect(await setInquiryStatus(container, "noti_nope", "done")).toBeNull()
    expect(updates).toEqual([])
  })

  it("údaje se dopíšou jednou — dvojklik je nepřepíše", async () => {
    const stored = buildStoredInquiry(input, context)
    const fresh = containerWith([feedOf(owner)])
    expect(await attachStoredInquiry(fresh.container, owner.key, stored)).toBe(true)
    expect(fresh.updates[0].data.inquiry).toEqual(stored)

    const already = containerWith([feedOf(owner, { inquiry: stored })])
    expect(await attachStoredInquiry(already.container, owner.key, { ...stored, photo_urls: [] })).toBe(true)
    expect(already.updates).toEqual([])
  })
})
