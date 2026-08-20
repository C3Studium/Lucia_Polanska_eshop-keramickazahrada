import crypto from "crypto"

/**
 * Delivery statistics for newsletter campaigns — the pure logic behind
 * `POST /hooks/newsletter-events` and the „Historie" tab's numbers.
 *
 * The mail service (Resend) reports what happened to each e-mail — delivered,
 * opened, clicked, bounced, complained — by calling a public webhook. This
 * module owns everything about those reports that can be tested without a
 * server:
 *
 * - the Svix signature check (every report is HMAC-signed; an unsigned POST
 *   to a public endpoint is just noise on the internet),
 * - the campaign tag: the fan-out stamps each e-mail with its campaign key,
 *   sanitised to the tag charset, so a report can be traced back,
 * - recording a report exactly once (webhooks retry until acknowledged),
 * - list hygiene: a permanently undeliverable mailbox or a spam complaint
 *   unsubscribes the address automatically — sending again would hurt both
 *   the recipient and the shop's sender reputation,
 * - the aggregation the admin displays.
 *
 * Unit-tested in `__tests__/newsletter-events.unit.spec.ts` with fake stores,
 * following `lib/newsletter-campaign.ts`'s pattern.
 */

export type NewsletterEventType =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"

/* ------------------------------------------------------------------ */
/* Campaign tags                                                       */
/* ------------------------------------------------------------------ */

/**
 * A campaign key, made safe for the mail service's tag rules (ASCII letters,
 * numbers, `_`, `-`, max 256 chars). Keys that are already clean pass
 * through unchanged; anything else gets its illegal characters replaced
 * *and* a short hash of the original appended — `blocks:a` and `blocks_a`
 * must never collapse into the same tag.
 */
export const sanitizeCampaignTag = (key: string): string => {
  if (!key) {
    return "kampan"
  }
  const cleaned = key.replace(/[^A-Za-z0-9_-]/g, "_")
  if (cleaned === key && key.length <= 256) {
    return key
  }
  const digest = crypto.createHash("sha256").update(key).digest("hex").slice(0, 8)
  return `${cleaned.slice(0, 240)}-${digest}`
}

/* ------------------------------------------------------------------ */
/* Svix signature                                                      */
/* ------------------------------------------------------------------ */

export type SvixVerification = { ok: boolean; reason?: string }

/**
 * Verifies a Svix-signed webhook delivery by hand (no extra dependency —
 * the scheme is three lines of crypto):
 *
 *   signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`
 *   expected      = base64(HMAC-SHA256(base64decode(secret sans "whsec_"),
 *                                      signedContent))
 *
 * The `svix-signature` header carries space-separated candidates
 * (`v1,<base64>`), any one of which may match — key rotation sends two.
 * Comparison is constant-time, and a timestamp older/newer than the
 * tolerance is rejected outright so a captured delivery cannot be replayed
 * next week.
 */
export const verifySvixSignature = ({
  secret,
  id,
  timestamp,
  signature,
  payload,
  toleranceSeconds = 300,
  nowMs = Date.now(),
}: {
  secret: string
  id: string | undefined
  timestamp: string | undefined
  signature: string | undefined
  payload: string
  toleranceSeconds?: number
  nowMs?: number
}): SvixVerification => {
  if (!secret) {
    return { ok: false, reason: "no-secret" }
  }
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing-headers" }
  }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "malformed-timestamp" }
  }
  if (Math.abs(nowMs / 1000 - ts) > toleranceSeconds) {
    return { ok: false, reason: "stale-timestamp" }
  }

  const key = Buffer.from(
    secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret,
    "base64"
  )
  if (!key.length) {
    return { ok: false, reason: "malformed-secret" }
  }

  const expected = Buffer.from(
    crypto
      .createHmac("sha256", key)
      .update(`${id}.${timestamp}.${payload}`)
      .digest("base64")
  )

  for (const candidate of signature.split(" ")) {
    const commaAt = candidate.indexOf(",")
    if (commaAt < 0 || candidate.slice(0, commaAt) !== "v1") {
      continue
    }
    const given = Buffer.from(candidate.slice(commaAt + 1))
    if (
      given.length === expected.length &&
      crypto.timingSafeEqual(given, expected)
    ) {
      return { ok: true }
    }
  }

  return { ok: false, reason: "no-matching-signature" }
}

/* ------------------------------------------------------------------ */
/* Reading the report payload                                          */
/* ------------------------------------------------------------------ */

const RESEND_EVENT_TYPES: Record<string, NewsletterEventType> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
}

/** Known report type → our event type; anything else → null (log and skip). */
export const mapResendEventType = (
  type: unknown
): NewsletterEventType | null =>
  typeof type === "string" ? RESEND_EVENT_TYPES[type] ?? null : null

/** The addressee, normalised the way `newsletter_subscriber.email` is. */
export const extractRecipientEmail = (data: unknown): string | null => {
  const to = (data as { to?: unknown } | null | undefined)?.to
  const first = Array.isArray(to) ? to[0] : to
  return typeof first === "string" && first.includes("@")
    ? first.trim().toLowerCase()
    : null
}

/** The clicked link of an `email.clicked` report — web URLs only. */
export const extractClickUrl = (data: unknown): string | null => {
  const link = (
    (data as { click?: { link?: unknown } } | null | undefined)?.click ?? {}
  ).link
  return typeof link === "string" && /^https?:\/\//i.test(link)
    ? link.slice(0, 2000)
    : null
}

/**
 * The campaign tag the fan-out stamped on the e-mail. Resend has carried
 * tags both as `[{name, value}]` and as a `{name: value}` map across
 * payload versions, so both shapes are read.
 */
export const extractCampaignTag = (data: unknown): string | null => {
  const tags = (data as { tags?: unknown } | null | undefined)?.tags
  if (Array.isArray(tags)) {
    for (const entry of tags) {
      const tag = entry as { name?: unknown; value?: unknown } | null
      if (tag?.name === "campaign" && typeof tag.value === "string") {
        return tag.value
      }
    }
    return null
  }
  if (tags && typeof tags === "object") {
    const value = (tags as Record<string, unknown>).campaign
    return typeof value === "string" ? value : null
  }
  return null
}

/**
 * Only a *permanent* bounce may suppress a subscriber — „mailbox full" is
 * bad luck, not consent withdrawn. When the report does not say (older
 * payloads), permanent is assumed: continuing to mail an address the
 * provider just bounced is the worse mistake.
 */
export const isHardBounce = (data: unknown): boolean => {
  const bounceType = (
    (data as { bounce?: { type?: unknown } } | null | undefined)?.bounce ?? {}
  ).type
  if (typeof bounceType !== "string") {
    return true
  }
  return !/transient|temporar/i.test(bounceType)
}

export type SuppressionReason = "bounce" | "complaint"

/** Which reports end a subscription, and under which recorded reason. */
export const suppressionReasonFor = (
  type: NewsletterEventType,
  data: unknown
): SuppressionReason | null => {
  if (type === "complained") {
    return "complaint"
  }
  if (type === "bounced" && isHardBounce(data)) {
    return "bounce"
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Recording                                                           */
/* ------------------------------------------------------------------ */

/** The slice of the newsletter module this logic needs — fakeable in tests. */
export type NewsletterEventStore = {
  listNewsletterCampaigns(
    filter: unknown,
    config?: unknown
  ): Promise<Array<Record<string, unknown>>>
  listNewsletterEvents(
    filter: unknown,
    config?: unknown
  ): Promise<Array<Record<string, unknown>>>
  createNewsletterEvents(data: unknown): Promise<unknown>
  listNewsletterSubscribers(
    filter: unknown,
    config?: unknown
  ): Promise<Array<Record<string, unknown>>>
  updateNewsletterSubscribers(data: unknown): Promise<unknown>
}

export type RecordEventInput = {
  /** The delivery's Svix id — one webhook delivery, however often retried. */
  svixId: string
  type: NewsletterEventType
  email: string
  url: string | null
  /** The campaign tag from the payload, if any. */
  tagValue: string | null
  suppressReason: SuppressionReason | null
  now?: Date
}

export type RecordEventResult = {
  recorded: boolean
  deduped: boolean
  campaignKey: string | null
  suppressed: SuppressionReason | null
}

/**
 * Records one report exactly once and applies list hygiene.
 *
 * Dedupe is `{svix id}:{type}`: the same delivery retried by the webhook
 * queue must not double-count, while distinct events about the same e-mail
 * (delivered, then opened) naturally have distinct svix ids anyway. The
 * unique index on `dedupe_key` backs the check against races — a violation
 * from a concurrent retry is read back as „already recorded", not an error.
 *
 * Suppression marks the subscriber unsubscribed (with the reason) only when
 * the row is still active — a person who already left keeps their own
 * unsubscribe story.
 */
export const recordNewsletterEvent = async (
  store: NewsletterEventStore,
  input: RecordEventInput
): Promise<RecordEventResult> => {
  const dedupeKey = `${input.svixId}:${input.type}`

  const [existing] = await store.listNewsletterEvents({
    dedupe_key: dedupeKey,
  })
  if (existing) {
    return {
      recorded: false,
      deduped: true,
      campaignKey: (existing.campaign_key as string | null) ?? null,
      suppressed: null,
    }
  }

  let campaignKey: string | null = null
  if (input.tagValue) {
    const [campaign] = await store.listNewsletterCampaigns({
      tag: input.tagValue,
    })
    campaignKey = (campaign?.campaign_key as string | undefined) ?? null
  }

  try {
    await store.createNewsletterEvents({
      campaign_key: campaignKey,
      email: input.email,
      type: input.type,
      url: input.url,
      dedupe_key: dedupeKey,
    })
  } catch (error) {
    // A concurrent retry may have won the unique index race. If the row is
    // there now, this delivery is already counted; anything else is real.
    const [raced] = await store.listNewsletterEvents({
      dedupe_key: dedupeKey,
    })
    if (raced) {
      return { recorded: false, deduped: true, campaignKey, suppressed: null }
    }
    throw error
  }

  let suppressed: SuppressionReason | null = null
  if (input.suppressReason) {
    const [subscriber] = await store.listNewsletterSubscribers({
      email: input.email,
    })
    if (subscriber && !subscriber.unsubscribed_at) {
      await store.updateNewsletterSubscribers({
        id: subscriber.id,
        unsubscribed_at: input.now ?? new Date(),
        suppressed_reason: input.suppressReason,
      })
      suppressed = input.suppressReason
    }
  }

  return { recorded: true, deduped: false, campaignKey, suppressed }
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export type NewsletterEventRow = {
  email: string
  type: string
  url?: string | null
}

export type CampaignLinkStats = {
  url: string
  /** Total clicks on this link. */
  clicks: number
  /** Distinct addresses that clicked it. */
  addresses: number
}

export type CampaignEventStats = {
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  links: CampaignLinkStats[]
}

/**
 * Counts are *distinct addresses*, not raw events: one person opening the
 * mail nine times is one reader, and pretending otherwise would flatter the
 * numbers she makes decisions with. Only the per-link `clicks` column counts
 * every click — „which link pulled" is a question about the link.
 */
export const aggregateNewsletterEvents = (
  rows: NewsletterEventRow[]
): CampaignEventStats => {
  const byType: Record<NewsletterEventType, Set<string>> = {
    delivered: new Set(),
    opened: new Set(),
    clicked: new Set(),
    bounced: new Set(),
    complained: new Set(),
  }
  const linkClicks = new Map<string, { clicks: number; addresses: Set<string> }>()

  for (const row of rows) {
    const type = row.type as NewsletterEventType
    if (!(type in byType)) {
      continue
    }
    const email = (row.email ?? "").trim().toLowerCase()
    if (!email) {
      continue
    }
    byType[type].add(email)

    if (type === "clicked" && row.url) {
      const entry = linkClicks.get(row.url) ?? {
        clicks: 0,
        addresses: new Set<string>(),
      }
      entry.clicks += 1
      entry.addresses.add(email)
      linkClicks.set(row.url, entry)
    }
  }

  return {
    delivered: byType.delivered.size,
    opened: byType.opened.size,
    clicked: byType.clicked.size,
    bounced: byType.bounced.size,
    complained: byType.complained.size,
    links: [...linkClicks.entries()]
      .map(([url, entry]) => ({
        url,
        clicks: entry.clicks,
        addresses: entry.addresses.size,
      }))
      .sort((a, b) => b.clicks - a.clicks || a.url.localeCompare(b.url)),
  }
}
