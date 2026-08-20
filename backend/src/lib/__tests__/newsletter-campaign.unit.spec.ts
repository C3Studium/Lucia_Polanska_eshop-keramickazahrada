import type { MedusaContainer } from "@medusajs/framework/types"
import { sendCampaign } from "../newsletter-campaign"

/**
 * The fan-out end to end against a faked container: given a subscriber list
 * in every state, exactly the confirmed-and-active addresses get a payload,
 * each with a working per-recipient unsubscribe link and the campaign's
 * idempotency key. This is the executable form of the legal rule — a
 * regression here means either an illegal e-mail or a silently skipped
 * subscriber, and neither is visible from the sending side.
 */

type Payload = {
  to: string
  channel: string
  template: string
  idempotency_key: string
  data: Record<string, unknown>
}

const subscriberRows = [
  {
    id: "sub_confirmed",
    email: "potvrzena@example.com",
    source: "storefront",
    subscribed_at: new Date("2026-08-01"),
    confirmed_at: new Date("2026-08-02"),
    unsubscribed_at: null,
  },
  {
    id: "sub_pending",
    email: "ceka@example.com",
    source: "storefront",
    subscribed_at: new Date("2026-08-03"),
    confirmed_at: null,
    unsubscribed_at: null,
  },
  {
    id: "sub_unsubscribed",
    email: "odhlasena@example.com",
    source: "storefront",
    subscribed_at: new Date("2026-08-01"),
    confirmed_at: new Date("2026-08-01"),
    unsubscribed_at: new Date("2026-08-05"),
  },
  {
    id: "sub_blank",
    email: "   ",
    source: null,
    subscribed_at: new Date("2026-08-01"),
    confirmed_at: new Date("2026-08-01"),
    unsubscribed_at: null,
  },
]

const containerWith = (created: Payload[][]) =>
  ({
    resolve: (key: string) => {
      if (key === "notification") {
        return {
          createNotifications: async (payloads: Payload[]) => {
            created.push(payloads)
            return payloads
          },
        }
      }
      if (key === "logger") {
        return { info: () => undefined, warn: () => undefined, error: () => undefined }
      }
      if (key === "newsletter") {
        return {
          // The DB-level filter narrows to active rows; the pending row
          // stays in on purpose — code, not SQL, decides consent.
          listNewsletterSubscribers: async (
            _filter: unknown,
            options: { skip?: number }
          ) =>
            (options?.skip ?? 0) > 0
              ? []
              : subscriberRows.filter((row) => !row.unsubscribed_at),
        }
      }
      throw new Error(`Unexpected resolve("${key}")`)
    },
  }) as unknown as MedusaContainer

describe("sendCampaign — confirmed subscribers only", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.JWT_SECRET = "test-secret"
    process.env.BACKEND_PUBLIC_URL = "https://api.example.com"
    delete process.env.DEV_NOTIFICATION_EMAIL
    delete process.env.OWNER_NOTIFICATION_EMAIL
  })

  afterAll(() => {
    process.env = env
  })

  it("mails exactly the confirmed, active, non-blank addresses", async () => {
    const created: Payload[][] = []

    const { sent } = await sendCampaign(containerWith(created), {
      campaignKey: "test-kampan",
      template: "promotional",
      data: { subject: "Novinky", blocks: [{ type: "paragraph", text: "Ahoj" }] },
    })

    const emails = created
      .flat()
      .filter((payload) => payload.channel === "email")

    expect(emails.map((payload) => payload.to)).toEqual([
      "potvrzena@example.com",
    ])
    expect(sent).toBe(1)
  })

  it("carries the campaign idempotency key and a signed unsubscribe link", async () => {
    const created: Payload[][] = []

    await sendCampaign(containerWith(created), {
      campaignKey: "test-kampan",
      template: "promotional",
      data: { subject: "Novinky" },
    })

    const [payload] = created
      .flat()
      .filter((entry) => entry.channel === "email")

    expect(payload.idempotency_key).toBe(
      "campaign:test-kampan:potvrzena@example.com"
    )
    expect(String(payload.data.unsubscribeLink)).toMatch(
      /^https:\/\/api\.example\.com\/newsletter\/unsubscribe\?email=potvrzena%40example\.com&token=[0-9a-f]{32}$/
    )
  })

  it("stamps every send with the campaign's delivery-report tag", async () => {
    const created: Payload[][] = []

    const { tag } = await sendCampaign(containerWith(created), {
      campaignKey: "blocks:2026-08-19:abc",
      template: "promotional",
      data: { subject: "Novinky" },
    })

    const [payload] = created
      .flat()
      .filter((entry) => entry.channel === "email")

    // The key's illegal characters are sanitised for the tag charset and the
    // same value is returned so the history row can store it.
    expect(tag).toMatch(/^blocks_2026-08-19_abc-[0-9a-f]{8}$/)
    expect(payload.data.__resendTags).toEqual([
      { name: "campaign", value: tag },
    ])
  })

  it("signs an unsubscribe link for bundle announcements too", async () => {
    // `bundle-published` fans out to the same subscriber list — obchodní
    // sdělení like any campaign, so the per-recipient link must ride along.
    const created: Payload[][] = []

    await sendCampaign(containerWith(created), {
      campaignKey: "bundle:bundle_1",
      template: "bundle-published",
      data: { subject: "Nový balíček", bundle: { id: "bundle_1" } },
    })

    const [payload] = created
      .flat()
      .filter((entry) => entry.channel === "email")

    expect(String(payload.data.unsubscribeLink)).toMatch(
      /^https:\/\/api\.example\.com\/newsletter\/unsubscribe\?email=potvrzena%40example\.com&token=[0-9a-f]{32}$/
    )
  })
})
