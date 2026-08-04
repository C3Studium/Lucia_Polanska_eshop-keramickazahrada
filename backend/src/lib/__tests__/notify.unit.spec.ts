import {
  buildEmailNotification,
  buildFeedNotification,
  MERCHANT_NOTIFICATION_TEMPLATE,
  notifyMerchant,
  resolveAllRecipients,
  resolveRecipient,
} from "../notify"

const containerWith = (created: unknown[][], warnings: string[]) => ({
  resolve: (key: string) => {
    if (key === "notification") {
      return {
        createNotifications: async (payloads: unknown[]) => {
          created.push(payloads)
          return payloads
        },
      }
    }
    if (key === "logger") {
      return {
        warn: (message: string) => warnings.push(message),
        info: () => undefined,
        error: () => undefined,
      }
    }
    throw new Error(`Unexpected resolve("${key}")`)
  },
})

describe("recipient routing (D7)", () => {
  it("routes technical failures to dev and business events to the owner", () => {
    const addresses = { dev: "dev@example.com", owner: "owner@example.com" }

    expect(resolveRecipient("dev", addresses)).toBe("dev@example.com")
    expect(resolveRecipient("owner", addresses)).toBe("owner@example.com")
  })

  it("treats missing, empty and whitespace-only addresses as not configured", () => {
    expect(resolveRecipient("dev", {})).toBeNull()
    expect(resolveRecipient("dev", { dev: "" })).toBeNull()
    expect(resolveRecipient("owner", { owner: "   " })).toBeNull()
  })

  it("collects both addresses for the digest, without duplicates", () => {
    expect(
      resolveAllRecipients({ dev: "a@example.com", owner: "b@example.com" })
    ).toEqual(["a@example.com", "b@example.com"])

    expect(
      resolveAllRecipients({ dev: "same@example.com", owner: "same@example.com" })
    ).toEqual(["same@example.com"])

    expect(resolveAllRecipients({ dev: "", owner: null })).toEqual([])
  })
})

describe("notification payloads", () => {
  const input = {
    key: "mn:new-order:order_1",
    title: "Nová zaplacená objednávka #1042",
    description: "Jana Nováková · 1 890 Kč",
    audience: "owner" as const,
    resource: { id: "order_1", type: "order" },
  }

  it("addresses the feed entry to everyone and always carries a title", () => {
    const feed = buildFeedNotification(input)

    // The bell queries `to: [user.id, user.email, ""]` and renders nothing
    // without `data.title` — both are load-bearing.
    expect(feed.to).toBe("")
    expect(feed.channel).toBe("feed")
    expect(feed.data.title).toBe(input.title)
    expect(feed.idempotency_key).toBe("mn:new-order:order_1")
    expect(feed.resource_id).toBe("order_1")
  })

  it("omits the description rather than sending an empty one", () => {
    const feed = buildFeedNotification({ ...input, description: undefined })
    expect(feed.data).not.toHaveProperty("description")
  })

  it("gives the e-mail its own dedupe key and a per-send subject", () => {
    const email = buildEmailNotification(input, "owner@example.com")

    expect(email.to).toBe("owner@example.com")
    expect(email.channel).toBe("email")
    expect(email.template).toBe(MERCHANT_NOTIFICATION_TEMPLATE)
    expect(email.data.subject).toBe(input.title)
    // Distinct from the feed key: one delivery failing must not suppress the
    // other's retry.
    expect(email.idempotency_key).toBe("mn:new-order:order_1:email")
  })
})

describe("notifyMerchant", () => {
  const baseInput = {
    key: "mn:ready:order_9",
    title: "Objednávka #9 je připravená k odeslání",
    audience: "owner" as const,
  }

  afterEach(() => {
    delete process.env.OWNER_NOTIFICATION_EMAIL
    delete process.env.DEV_NOTIFICATION_EMAIL
  })

  it("sends the bell entry only for an ordinary info notification", async () => {
    const created: unknown[][] = []
    const warnings: string[] = []

    const result = await notifyMerchant(
      containerWith(created, warnings) as never,
      baseInput
    )

    expect(result).toEqual({ feed: true, email: "not-requested" })
    expect(created).toHaveLength(1)
    expect(created[0]).toHaveLength(1)
    expect(warnings).toEqual([])
  })

  it("adds the e-mail when the notification asks for one", async () => {
    process.env.OWNER_NOTIFICATION_EMAIL = "owner@example.com"
    const created: unknown[][] = []
    const warnings: string[] = []

    const result = await notifyMerchant(
      containerWith(created, warnings) as never,
      { ...baseInput, email: true }
    )

    expect(result.email).toBe("sent")
    expect(created[0]).toHaveLength(2)
  })

  it("skips the e-mail with a warning when the address is not configured", async () => {
    const created: unknown[][] = []
    const warnings: string[] = []

    const result = await notifyMerchant(
      containerWith(created, warnings) as never,
      { ...baseInput, urgent: true }
    )

    // D7: an empty env means skip and log — never crash, never silently drop.
    expect(result.email).toBe("no-recipient")
    expect(created[0]).toHaveLength(1)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain("OWNER_NOTIFICATION_EMAIL")
  })

  it("names the dev variable when a technical failure has no address", async () => {
    const created: unknown[][] = []
    const warnings: string[] = []

    await notifyMerchant(containerWith(created, warnings) as never, {
      key: "mn:shipfail:order_3:2026080412",
      title: "Zásilku se nepodařilo vytvořit",
      audience: "dev",
      urgent: true,
    })

    expect(warnings[0]).toContain("DEV_NOTIFICATION_EMAIL")
  })

  it("re-sends the same key on retry, leaving deduplication to the module", async () => {
    process.env.OWNER_NOTIFICATION_EMAIL = "owner@example.com"
    const created: unknown[][] = []
    const warnings: string[] = []
    const container = containerWith(created, warnings) as never

    await notifyMerchant(container, { ...baseInput, email: true })
    await notifyMerchant(container, { ...baseInput, email: true })

    // At-least-once delivery means the handler runs twice; both calls carry the
    // identical idempotency keys that `createNotifications` deduplicates on, so
    // only one bell entry and one e-mail ever exist.
    const keys = created.flat().map((payload) => (payload as any).idempotency_key)
    expect(keys).toEqual([
      "mn:ready:order_9",
      "mn:ready:order_9:email",
      "mn:ready:order_9",
      "mn:ready:order_9:email",
    ])
  })
})
