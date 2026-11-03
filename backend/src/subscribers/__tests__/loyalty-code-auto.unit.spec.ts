import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import loyaltyCodeAuto from "../loyalty-code-auto"

/**
 * Automat „kód po N. zaplacené objednávce" nad kontejnerem v paměti:
 * kdo kód dostane, a že opakovaná událost nic nezdvojí.
 */

type World = {
  settings: Record<string, unknown>
  customers: any[]
  orders: any[]
  subscriber: any | null
}

const paidOrder = (id: string, customerId: string) => ({
  id,
  email: "jana@example.com",
  customer_id: customerId,
  status: "pending",
  metadata: {},
  payment_collections: [{ status: "completed", payments: [{ captured_at: "2026-11-01T10:00:00Z" }] }],
})

const build = (world: World) => {
  const campaigns: any[] = []
  const notifications: any[] = []
  const promotionModule = {
    listCampaigns: jest.fn(async (filters: any) =>
      campaigns.filter((campaign) => campaign.campaign_identifier === filters.campaign_identifier)
    ),
    createPromotions: jest.fn(async ([input]: any[]) => {
      if (campaigns.some((campaign) => campaign.campaign_identifier === input.campaign.campaign_identifier)) {
        throw new Error("already exists")
      }
      campaigns.push({
        ...input.campaign,
        promotions: [{ code: input.code, status: input.status, application_method: input.application_method }],
      })
      return [input]
    }),
  }
  const graph = jest.fn(async ({ entity, filters }: any) => {
    if (entity === "payment") {
      const order = world.orders.find((row) => `pay_${row.id}` === filters.id)
      return { data: order ? [{ id: filters.id, payment_collection: { order } }] : [] }
    }
    if (entity === "order") {
      if (filters.id) return { data: world.orders.filter((row) => row.id === filters.id) }
      if (filters.customer_id) {
        return { data: world.orders.filter((row) => filters.customer_id.includes(row.customer_id)) }
      }
      if (filters.email) return { data: world.orders.filter((row) => row.email === filters.email) }
    }
    return { data: [] }
  })
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    [ContainerRegistrationKeys.QUERY]: { graph },
    [Modules.STORE]: {
      listStores: async () => [{ id: "store_1", metadata: { merchant_settings: world.settings } }],
    },
    [Modules.CUSTOMER]: {
      listCustomers: async (filters: any) =>
        filters.id ? world.customers.filter((row) => row.id === filters.id) : world.customers,
    },
    newsletter: {
      listNewsletterSubscribers: async () => (world.subscriber ? [world.subscriber] : []),
    },
    [Modules.PROMOTION]: promotionModule,
    [Modules.NOTIFICATION]: {
      // Jako notifikační modul: klíč, který už odešel, se znovu neposílá.
      createNotifications: jest.fn(async (input: any) => {
        if (!notifications.some((row) => row.idempotency_key === input.idempotency_key)) {
          notifications.push(input)
        }
      }),
    },
  }
  const container = {
    resolve: (key: string) => {
      if (!(key in services)) throw new Error(`neznámá služba ${key}`)
      return services[key]
    },
  } as any
  const run = (orderId: string) =>
    loyaltyCodeAuto({ event: { name: "payment.captured", data: { id: `pay_${orderId}` } }, container } as any)
  return { run, campaigns, notifications, promotionModule, logger: services[ContainerRegistrationKeys.LOGGER] as any }
}

const registered = { id: "cus_ACC", email: "jana@example.com", has_account: true, created_at: "2026-01-01", first_name: "Jana", metadata: {} }
const confirmed = { email: "jana@example.com", confirmed_at: "2026-02-01", unsubscribed_at: null }
const enabled = {
  loyalty_code: { auto_enabled: true, after_orders: 3, percentage: 10, valid_days: 60 },
  test_mode_enabled: false,
}

describe("automatický slevový kód po zaplacení", () => {
  const env = process.env
  beforeAll(() => {
    process.env = {
      ...env,
      JWT_SECRET: "test-secret",
      STOREFRONT_PUBLIC_URL: "https://keramickazahrada.cz",
      BACKEND_PUBLIC_URL: "https://api.keramickazahrada.cz",
    }
  })
  afterAll(() => {
    process.env = env
  })

  it("na 3. zaplacené objednávce založí kód jen pro zákazníka a pošle ho — dvojí událost nic nezdvojí", async () => {
    const world: World = {
      settings: enabled,
      customers: [registered],
      orders: [paidOrder("o1", "cus_ACC"), paidOrder("o2", "cus_ACC"), paidOrder("o3", "cus_ACC")],
      subscriber: confirmed,
    }
    const { run, campaigns, notifications, promotionModule } = build(world)
    await run("o3")
    await run("o3")
    expect(promotionModule.createPromotions).toHaveBeenCalledTimes(1)
    expect(campaigns).toHaveLength(1)
    expect(campaigns[0].campaign_identifier).toBe("kz-kod-cus_ACC-po-3")
    const [input] = promotionModule.createPromotions.mock.calls[0][0]
    expect(input.rules).toEqual([{ attribute: "customer.id", operator: "in", values: ["cus_ACC"] }])
    expect(input.status).toBe("active")
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      to: "jana@example.com",
      template: "loyalty-code",
      idempotency_key: "loyalty-code:kz-kod-cus_ACC-po-3",
      resource_id: "o3",
    })
    expect(notifications[0].data).toMatchObject({ percentage: 10, code: input.code, registered: true })
    expect(notifications[0].data.unsubscribeLink).toBeTruthy()
  })

  it("další zaplacená objednávka už druhý kód nepošle", async () => {
    const world: World = {
      settings: enabled,
      customers: [registered],
      orders: ["o1", "o2", "o3"].map((id) => paidOrder(id, "cus_ACC")),
      subscriber: confirmed,
    }
    const { run, notifications, promotionModule } = build(world)
    await run("o3")
    world.orders.push(paidOrder("o4", "cus_ACC"))
    await run("o4")
    expect(promotionModule.createPromotions).toHaveBeenCalledTimes(1)
    expect(notifications).toHaveLength(1)
  })

  it.each([
    ["automat vypnutý", { settings: { loyalty_code: { ...enabled.loyalty_code, auto_enabled: false } } }],
    ["zkušební režim", { settings: { ...enabled, test_mode_enabled: true } }],
    ["host bez účtu", { customers: [{ ...registered, has_account: false }] }],
    ["neodebírá newsletter", { subscriber: null }],
    ["odhlásil se z newsletteru", { subscriber: { ...confirmed, unsubscribed_at: "2026-10-01" } }],
    ["teprve 2 zaplacené", { orders: ["o1", "o3"].map((id) => paidOrder(id, "cus_ACC")) }],
    [
      "třetí objednávka zatím nezaplacená",
      {
        orders: [
          paidOrder("o1", "cus_ACC"),
          paidOrder("o2", "cus_ACC"),
          { ...paidOrder("o3", "cus_ACC"), payment_collections: [{ status: "authorized", payments: [] }] },
        ],
      },
    ],
  ] as const)("nepošle nic: %s", async (_label, override) => {
    const world: World = {
      settings: enabled,
      customers: [registered],
      orders: ["o1", "o2", "o3"].map((id) => paidOrder(id, "cus_ACC")),
      subscriber: confirmed,
      ...(override as Partial<World>),
    }
    const { run, notifications, promotionModule, logger } = build(world)
    await run("o3")
    expect(promotionModule.createPromotions).not.toHaveBeenCalled()
    expect(notifications).toHaveLength(0)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it("chyba při zakládání kódu nespadne ven (platba se nesmí kvůli dárku pokazit)", async () => {
    const world: World = {
      settings: enabled,
      customers: [registered],
      orders: ["o1", "o2", "o3"].map((id) => paidOrder(id, "cus_ACC")),
      subscriber: confirmed,
    }
    const { run, promotionModule, logger } = build(world)
    promotionModule.createPromotions.mockRejectedValue(new Error("databáze nejede"))
    await expect(run("o3")).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalled()
  })
})
