import crypto from "crypto"
import {
  aggregateNewsletterEvents,
  extractCampaignTag,
  extractClickUrl,
  extractRecipientEmail,
  isHardBounce,
  mapResendEventType,
  recordNewsletterEvent,
  sanitizeCampaignTag,
  suppressionReasonFor,
  verifySvixSignature,
  type NewsletterEventStore,
} from "../newsletter-events"

/**
 * The delivery-report pipeline, piece by piece: the webhook endpoint is only
 * as trustworthy as this signature check, and the statistics are only as
 * honest as the dedupe + aggregation. Fake stores, no server — the same
 * pattern as `newsletter-campaign.unit.spec.ts`.
 */

/* ------------------------------------------------------------------ */
/* sanitizeCampaignTag                                                 */
/* ------------------------------------------------------------------ */

describe("sanitizeCampaignTag", () => {
  it("passes already-clean keys through unchanged", () => {
    expect(sanitizeCampaignTag("jarni-akce_2026")).toBe("jarni-akce_2026")
  })

  it("replaces illegal characters and appends a hash of the original", () => {
    const tag = sanitizeCampaignTag("blocks:2026-08-19:abc123")
    expect(tag).toMatch(/^blocks_2026-08-19_abc123-[0-9a-f]{8}$/)
  })

  it("keeps distinct keys distinct even when they clean to the same string", () => {
    expect(sanitizeCampaignTag("blocks:a")).not.toBe(
      sanitizeCampaignTag("blocks_a")
    )
    expect(sanitizeCampaignTag("blocks:a")).not.toBe(
      sanitizeCampaignTag("blocks.a")
    )
  })

  it("never returns an empty tag", () => {
    expect(sanitizeCampaignTag("")).toBe("kampan")
  })

  it("caps overlong keys within the tag limit", () => {
    const tag = sanitizeCampaignTag("š".repeat(400))
    expect(tag.length).toBeLessThanOrEqual(256)
    expect(tag).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

/* ------------------------------------------------------------------ */
/* verifySvixSignature                                                 */
/* ------------------------------------------------------------------ */

describe("verifySvixSignature", () => {
  const rawSecret = crypto.randomBytes(24)
  const secret = `whsec_${rawSecret.toString("base64")}`
  const payload = JSON.stringify({ type: "email.delivered" })
  const id = "msg_2abc"
  const now = 1_766_000_000_000

  const signatureFor = (
    signedId: string,
    timestamp: string,
    body: string
  ): string =>
    crypto
      .createHmac("sha256", rawSecret)
      .update(`${signedId}.${timestamp}.${body}`)
      .digest("base64")

  it("accepts a correctly signed, fresh delivery", () => {
    const timestamp = String(Math.floor(now / 1000))
    const result = verifySvixSignature({
      secret,
      id,
      timestamp,
      signature: `v1,${signatureFor(id, timestamp, payload)}`,
      payload,
      nowMs: now,
    })
    expect(result.ok).toBe(true)
  })

  it("accepts when any of several space-separated candidates matches", () => {
    const timestamp = String(Math.floor(now / 1000))
    const good = signatureFor(id, timestamp, payload)
    const result = verifySvixSignature({
      secret,
      id,
      timestamp,
      signature: `v1,${Buffer.from("wrong").toString("base64")} v1,${good}`,
      payload,
      nowMs: now,
    })
    expect(result.ok).toBe(true)
  })

  it("rejects a wrong signature", () => {
    const timestamp = String(Math.floor(now / 1000))
    const result = verifySvixSignature({
      secret,
      id,
      timestamp,
      signature: `v1,${signatureFor(id, timestamp, payload + "x")}`,
      payload,
      nowMs: now,
    })
    expect(result).toEqual({ ok: false, reason: "no-matching-signature" })
  })

  it("rejects a signature over a different svix id", () => {
    const timestamp = String(Math.floor(now / 1000))
    const result = verifySvixSignature({
      secret,
      id,
      timestamp,
      signature: `v1,${signatureFor("msg_other", timestamp, payload)}`,
      payload,
      nowMs: now,
    })
    expect(result.ok).toBe(false)
  })

  it("rejects a stale timestamp (replay protection)", () => {
    const timestamp = String(Math.floor(now / 1000) - 600)
    const result = verifySvixSignature({
      secret,
      id,
      timestamp,
      signature: `v1,${signatureFor(id, timestamp, payload)}`,
      payload,
      nowMs: now,
    })
    expect(result).toEqual({ ok: false, reason: "stale-timestamp" })
  })

  it("rejects a timestamp from the future beyond tolerance", () => {
    const timestamp = String(Math.floor(now / 1000) + 600)
    const result = verifySvixSignature({
      secret,
      id,
      timestamp,
      signature: `v1,${signatureFor(id, timestamp, payload)}`,
      payload,
      nowMs: now,
    })
    expect(result.ok).toBe(false)
  })

  it("rejects malformed input: missing headers, bad timestamp, empty secret", () => {
    const timestamp = String(Math.floor(now / 1000))
    expect(
      verifySvixSignature({
        secret,
        id: undefined,
        timestamp,
        signature: "v1,abc",
        payload,
        nowMs: now,
      }).ok
    ).toBe(false)
    expect(
      verifySvixSignature({
        secret,
        id,
        timestamp: "kdy",
        signature: "v1,abc",
        payload,
        nowMs: now,
      })
    ).toEqual({ ok: false, reason: "malformed-timestamp" })
    expect(
      verifySvixSignature({
        secret: "",
        id,
        timestamp,
        signature: "v1,abc",
        payload,
        nowMs: now,
      })
    ).toEqual({ ok: false, reason: "no-secret" })
    expect(
      verifySvixSignature({
        secret,
        id,
        timestamp,
        signature: "v2,neco divneho",
        payload,
        nowMs: now,
      })
    ).toEqual({ ok: false, reason: "no-matching-signature" })
  })

  it("accepts a secret without the whsec_ prefix (raw base64)", () => {
    const timestamp = String(Math.floor(now / 1000))
    const result = verifySvixSignature({
      secret: rawSecret.toString("base64"),
      id,
      timestamp,
      signature: `v1,${signatureFor(id, timestamp, payload)}`,
      payload,
      nowMs: now,
    })
    expect(result.ok).toBe(true)
  })

  it("rejects a secret that decodes to nothing instead of verifying with an empty key", () => {
    const timestamp = String(Math.floor(now / 1000))
    const result = verifySvixSignature({
      // Buffer.from(_, "base64") silently ignores non-alphabet characters —
      // this must land on malformed-secret, never an HMAC with a zero key.
      secret: "whsec_!!!",
      id,
      timestamp,
      signature: `v1,${signatureFor(id, timestamp, payload)}`,
      payload,
      nowMs: now,
    })
    expect(result).toEqual({ ok: false, reason: "malformed-secret" })
  })

  it("checks freshness before any crypto — a stale replay is rejected even with a perfect signature", () => {
    const staleTimestamp = String(Math.floor(now / 1000) - 301)
    const result = verifySvixSignature({
      secret,
      id,
      timestamp: staleTimestamp,
      signature: `v1,${signatureFor(id, staleTimestamp, payload)}`,
      payload,
      nowMs: now,
    })
    expect(result).toEqual({ ok: false, reason: "stale-timestamp" })
  })
})

/* ------------------------------------------------------------------ */
/* Payload readers                                                     */
/* ------------------------------------------------------------------ */

describe("payload readers", () => {
  it("maps exactly the five tracked report types", () => {
    expect(mapResendEventType("email.delivered")).toBe("delivered")
    expect(mapResendEventType("email.opened")).toBe("opened")
    expect(mapResendEventType("email.clicked")).toBe("clicked")
    expect(mapResendEventType("email.bounced")).toBe("bounced")
    expect(mapResendEventType("email.complained")).toBe("complained")
    expect(mapResendEventType("email.sent")).toBeNull()
    expect(mapResendEventType(undefined)).toBeNull()
  })

  it("reads the recipient from array or string, normalised", () => {
    expect(extractRecipientEmail({ to: ["Jana@Example.com"] })).toBe(
      "jana@example.com"
    )
    expect(extractRecipientEmail({ to: "jana@example.com" })).toBe(
      "jana@example.com"
    )
    expect(extractRecipientEmail({ to: [] })).toBeNull()
    expect(extractRecipientEmail({})).toBeNull()
  })

  it("reads click links, web URLs only", () => {
    expect(
      extractClickUrl({ click: { link: "https://example.com/store" } })
    ).toBe("https://example.com/store")
    expect(extractClickUrl({ click: { link: "javascript:alert(1)" } })).toBeNull()
    expect(extractClickUrl({})).toBeNull()
  })

  it("reads the campaign tag from both historical payload shapes", () => {
    expect(
      extractCampaignTag({ tags: [{ name: "campaign", value: "jaro-2026" }] })
    ).toBe("jaro-2026")
    expect(extractCampaignTag({ tags: { campaign: "jaro-2026" } })).toBe(
      "jaro-2026"
    )
    expect(extractCampaignTag({ tags: [] })).toBeNull()
    expect(extractCampaignTag({})).toBeNull()
  })

  it("treats only explicitly transient bounces as soft", () => {
    expect(isHardBounce({ bounce: { type: "Permanent" } })).toBe(true)
    expect(isHardBounce({ bounce: { type: "Transient" } })).toBe(false)
    expect(isHardBounce({})).toBe(true)
  })

  it("derives the suppression reason from type + bounce hardness", () => {
    expect(suppressionReasonFor("complained", {})).toBe("complaint")
    expect(
      suppressionReasonFor("bounced", { bounce: { type: "Permanent" } })
    ).toBe("bounce")
    expect(
      suppressionReasonFor("bounced", { bounce: { type: "Transient" } })
    ).toBeNull()
    expect(suppressionReasonFor("opened", {})).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* recordNewsletterEvent                                               */
/* ------------------------------------------------------------------ */

type FakeStoreState = {
  campaigns: Array<Record<string, unknown>>
  events: Array<Record<string, unknown>>
  subscribers: Array<Record<string, unknown>>
  updates: Array<Record<string, unknown>>
  failCreateOnce?: boolean
}

const fakeStore = (state: FakeStoreState): NewsletterEventStore => ({
  listNewsletterCampaigns: async (filter) => {
    const tag = (filter as { tag?: string }).tag
    return state.campaigns.filter((campaign) => campaign.tag === tag)
  },
  listNewsletterEvents: async (filter) => {
    const key = (filter as { dedupe_key?: string }).dedupe_key
    return state.events.filter((event) => event.dedupe_key === key)
  },
  createNewsletterEvents: async (data) => {
    if (state.failCreateOnce) {
      state.failCreateOnce = false
      // Simulates losing the unique-index race to a concurrent retry.
      state.events.push(data as Record<string, unknown>)
      throw new Error("duplicate key value violates unique constraint")
    }
    state.events.push(data as Record<string, unknown>)
    return data
  },
  listNewsletterSubscribers: async (filter) => {
    const email = (filter as { email?: string }).email
    return state.subscribers.filter((subscriber) => subscriber.email === email)
  },
  updateNewsletterSubscribers: async (data) => {
    state.updates.push(data as Record<string, unknown>)
    return data
  },
})

describe("recordNewsletterEvent", () => {
  const base = () =>
    ({
      campaigns: [
        { id: "camp_1", campaign_key: "blocks:2026-08-19:abc", tag: "blocks_2026-08-19_abc-12345678" },
      ],
      events: [],
      subscribers: [
        {
          id: "sub_1",
          email: "jana@example.com",
          unsubscribed_at: null,
          suppressed_reason: null,
        },
      ],
      updates: [],
    }) as FakeStoreState

  it("records an event and resolves the campaign key from the tag", async () => {
    const state = base()
    const result = await recordNewsletterEvent(fakeStore(state), {
      svixId: "msg_1",
      type: "opened",
      email: "jana@example.com",
      url: null,
      tagValue: "blocks_2026-08-19_abc-12345678",
      suppressReason: null,
    })

    expect(result).toEqual({
      recorded: true,
      deduped: false,
      campaignKey: "blocks:2026-08-19:abc",
      suppressed: null,
    })
    expect(state.events).toEqual([
      {
        campaign_key: "blocks:2026-08-19:abc",
        email: "jana@example.com",
        type: "opened",
        url: null,
        dedupe_key: "msg_1:opened",
      },
    ])
  })

  it("acknowledges a retried delivery without counting it twice", async () => {
    const state = base()
    const store = fakeStore(state)
    const input = {
      svixId: "msg_1",
      type: "delivered" as const,
      email: "jana@example.com",
      url: null,
      tagValue: null,
      suppressReason: null,
    }

    const first = await recordNewsletterEvent(store, input)
    const second = await recordNewsletterEvent(store, input)

    expect(first.recorded).toBe(true)
    expect(second).toMatchObject({ recorded: false, deduped: true })
    expect(state.events).toHaveLength(1)
  })

  it("treats losing the unique-index race as a dedupe, not an error", async () => {
    const state = base()
    state.failCreateOnce = true

    const result = await recordNewsletterEvent(fakeStore(state), {
      svixId: "msg_1",
      type: "clicked",
      email: "jana@example.com",
      url: "https://example.com",
      tagValue: null,
      suppressReason: null,
    })

    expect(result).toMatchObject({ recorded: false, deduped: true })
  })

  it("unsubscribes an active address on a hard bounce, with the reason", async () => {
    const state = base()
    const result = await recordNewsletterEvent(fakeStore(state), {
      svixId: "msg_2",
      type: "bounced",
      email: "jana@example.com",
      url: null,
      tagValue: null,
      suppressReason: "bounce",
      now: new Date("2026-08-19T10:00:00Z"),
    })

    expect(result.suppressed).toBe("bounce")
    expect(state.updates).toEqual([
      {
        id: "sub_1",
        unsubscribed_at: new Date("2026-08-19T10:00:00Z"),
        suppressed_reason: "bounce",
      },
    ])
  })

  it("unsubscribes on a spam complaint too", async () => {
    const state = base()
    const result = await recordNewsletterEvent(fakeStore(state), {
      svixId: "msg_3",
      type: "complained",
      email: "jana@example.com",
      url: null,
      tagValue: null,
      suppressReason: "complaint",
    })

    expect(result.suppressed).toBe("complaint")
    expect(state.updates[0]).toMatchObject({ suppressed_reason: "complaint" })
  })

  it("leaves an already-unsubscribed address alone — their story stays theirs", async () => {
    const state = base()
    state.subscribers[0].unsubscribed_at = new Date("2026-08-01")

    const result = await recordNewsletterEvent(fakeStore(state), {
      svixId: "msg_4",
      type: "bounced",
      email: "jana@example.com",
      url: null,
      tagValue: null,
      suppressReason: "bounce",
    })

    expect(result.suppressed).toBeNull()
    expect(state.updates).toEqual([])
    // The event itself is still recorded — the statistics stay honest.
    expect(state.events).toHaveLength(1)
  })

  it("records events for unknown tags with campaign_key null", async () => {
    const state = base()
    const result = await recordNewsletterEvent(fakeStore(state), {
      svixId: "msg_5",
      type: "delivered",
      email: "jana@example.com",
      url: null,
      tagValue: "neznamy-tag",
      suppressReason: null,
    })

    expect(result.campaignKey).toBeNull()
    expect(state.events[0].campaign_key).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* aggregateNewsletterEvents                                           */
/* ------------------------------------------------------------------ */

describe("aggregateNewsletterEvents", () => {
  it("counts distinct addresses per type, not raw events", () => {
    const stats = aggregateNewsletterEvents([
      { email: "a@example.com", type: "delivered" },
      { email: "b@example.com", type: "delivered" },
      { email: "a@example.com", type: "opened" },
      { email: "A@example.com", type: "opened" },
      { email: "a@example.com", type: "opened" },
      { email: "b@example.com", type: "clicked", url: "https://example.com/x" },
      { email: "c@example.com", type: "bounced" },
      { email: "d@example.com", type: "complained" },
      { email: "e@example.com", type: "neco-jineho" },
    ])

    expect(stats.delivered).toBe(2)
    expect(stats.opened).toBe(1)
    expect(stats.clicked).toBe(1)
    expect(stats.bounced).toBe(1)
    expect(stats.complained).toBe(1)
  })

  it("groups clicks per link: total clicks and distinct addresses", () => {
    const stats = aggregateNewsletterEvents([
      { email: "a@example.com", type: "clicked", url: "https://example.com/x" },
      { email: "a@example.com", type: "clicked", url: "https://example.com/x" },
      { email: "b@example.com", type: "clicked", url: "https://example.com/x" },
      { email: "a@example.com", type: "clicked", url: "https://example.com/y" },
      { email: "c@example.com", type: "clicked", url: null },
    ])

    expect(stats.links).toEqual([
      { url: "https://example.com/x", clicks: 3, addresses: 2 },
      { url: "https://example.com/y", clicks: 1, addresses: 1 },
    ])
  })

  it("handles an empty list", () => {
    expect(aggregateNewsletterEvents([])).toEqual({
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      links: [],
    })
  })
})
