import { googleReviewUrl } from "../google-review-url"
import {
  claimVerdict,
  isInReviewWindow,
  isPickupOrder,
  latestShippedAt,
  receivedAtFor,
} from "../review-request-rules"

/**
 * Prosba o recenzi — kdy je „převzato" a kdy mlčet (docs/sledovani-zasilek.md §6).
 */

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-10-09T10:00:00.000Z")

describe("okamžik převzetí", () => {
  it("sledovaná zásilka = delivered_at; nedoručená = nic", () => {
    const delivered = new Date("2026-10-01T12:00:00.000Z")
    expect(
      receivedAtFor({ tracking: { delivered_at: delivered }, shipped_at: new Date("2026-09-28"), is_pickup: false })
    ).toEqual(delivered)
    expect(
      receivedAtFor({ tracking: { delivered_at: null }, shipped_at: new Date("2026-09-28"), is_pickup: false })
    ).toBeNull()
    // Uzavřené sledování bez doručení (vrácená, vzdaná) — nikdy.
    expect(
      receivedAtFor({ tracking: { delivered_at: null, done: true }, shipped_at: new Date("2026-09-28"), is_pickup: false })
    ).toBeNull()
  })

  it("osobní odběr = shipped_at (vyzvednutí); nesledovaná zásilka = shipped_at + 3 dny", () => {
    const shipped = new Date("2026-10-01T12:00:00.000Z")
    expect(receivedAtFor({ tracking: null, shipped_at: shipped, is_pickup: true })).toEqual(shipped)
    expect(receivedAtFor({ tracking: null, shipped_at: shipped, is_pickup: false })).toEqual(
      new Date(shipped.getTime() + 3 * DAY)
    )
    expect(receivedAtFor({ tracking: null, shipped_at: null, is_pickup: false })).toBeNull()
  })

  it("okno: od review_request_days po převzetí, nejdéle 30 dnů poté", () => {
    const received = new Date(NOW.getTime() - 7 * DAY)
    expect(isInReviewWindow(received, 7, NOW)).toBe(true)
    expect(isInReviewWindow(new Date(NOW.getTime() - 6 * DAY), 7, NOW)).toBe(false)
    expect(isInReviewWindow(new Date(NOW.getTime() - 37 * DAY), 7, NOW)).toBe(true)
    expect(isInReviewWindow(new Date(NOW.getTime() - 38 * DAY), 7, NOW)).toBe(false)
  })

  it("nejpozdější odeslání nezrušeného fulfillmentu", () => {
    expect(
      latestShippedAt([
        { shipped_at: "2026-10-01T00:00:00.000Z" },
        { shipped_at: "2026-10-05T00:00:00.000Z", canceled_at: "2026-10-06T00:00:00.000Z" },
        { shipped_at: "2026-10-03T00:00:00.000Z" },
      ])
    ).toEqual(new Date("2026-10-03T00:00:00.000Z"))
    expect(latestShippedAt([])).toBeNull()
    expect(latestShippedAt(null)).toBeNull()
  })

  it("osobní odběr podle dopravní metody", () => {
    expect(isPickupOrder({ shipping_methods: [{ data: { personal_pickup: true } }] })).toBe(true)
    expect(isPickupOrder({ shipping_methods: [{ data: { service_code: "PICKUP" } }] })).toBe(true)
    expect(isPickupOrder({ shipping_methods: [{ shipping_option: { provider_id: "osobni-odber_pickup" } }] })).toBe(true)
    expect(isPickupOrder({ shipping_methods: [{ data: { service_code: "NB" } }] })).toBe(false)
    expect(isPickupOrder({})).toBe(false)
  })
})

describe("reklamace a prosba o recenzi", () => {
  it("bez žádosti se posílá", () => {
    expect(claimVerdict([])).toBe("send")
    expect(claimVerdict(null)).toBe("send")
  })

  it("otevřená žádost odkládá", () => {
    for (const status of ["pending", "approved", "received"]) {
      expect(claimVerdict([{ status }])).toBe("defer")
    }
  })

  it("zamítnutá / zrušená / vyřízená vrácením peněz = nikdy", () => {
    expect(claimVerdict([{ status: "rejected" }])).toBe("never")
    expect(claimVerdict([{ status: "cancelled" }])).toBe("never")
    expect(claimVerdict([{ status: "resolved", refund_amount: 450 }])).toBe("never")
    expect(claimVerdict([{ status: "resolved", refunds: [{ amount: 100 }] }])).toBe("never")
  })

  it("vyřízená bez peněz (oprava, výměna) prosbu nebrání", () => {
    expect(claimVerdict([{ status: "resolved", refund_amount: 0, refunds: [] }])).toBe("send")
    expect(claimVerdict([{ status: "resolved" }])).toBe("send")
  })

  it(`„nikdy" vítězí nad „odložit"`, () => {
    expect(claimVerdict([{ status: "pending" }, { status: "rejected" }])).toBe("never")
  })
})

describe("odkaz na recenzi na Google", () => {
  it("celá URL má přednost, pak Place ID, jinak nic", () => {
    expect(googleReviewUrl({ GOOGLE_REVIEW_URL: "https://g.page/r/abc/review", GOOGLE_PLACE_ID: "ChIJx" })).toBe(
      "https://g.page/r/abc/review"
    )
    expect(googleReviewUrl({ GOOGLE_PLACE_ID: "ChIJx" })).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJx"
    )
    expect(googleReviewUrl({ GOOGLE_REVIEW_URL: "  ", GOOGLE_PLACE_ID: "" })).toBeNull()
    expect(googleReviewUrl({})).toBeNull()
  })
})
