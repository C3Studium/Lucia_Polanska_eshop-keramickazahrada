import { MedusaError } from "@medusajs/framework/utils"

jest.mock("../customer-email", () => ({
  ...jest.requireActual("../customer-email"),
  sendCustomerEmail: jest.fn(),
}))

import { sendCustomerEmail } from "../customer-email"
import {
  estimatedCompletionText,
  PRODUCTION_START_EMAIL_FAILED,
  productionMaxDaysOf,
  startProduction,
} from "../made-to-order/start-production"

/**
 * Z3 (LEGAL_AUDIT.md § 0): zahájení výroby platí od ODESLANÉHO e-mailu.
 * Bez e-mailu se výroba nezahájí — fáze se vrátí na `confirmed`.
 */

const sendMock = sendCustomerEmail as jest.MockedFunction<typeof sendCustomerEmail>

type Call = Record<string, unknown>

const makeContainer = (options: {
  productionOrder: Record<string, unknown>
  notifications?: Array<Record<string, unknown>>
}) => {
  const updates: Call[] = []
  let current: Record<string, unknown> = { ...options.productionOrder }
  const madeToOrder = {
    updateProductionOrders: jest.fn(async (patch: Call) => {
      updates.push(patch)
      current = { ...current, ...patch }
      return current
    }),
  }
  const notifications = {
    listNotifications: jest.fn(async () => options.notifications ?? []),
  }
  const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
  const order = {
    id: "order_1",
    display_id: 42,
    email: "jana@example.com",
    currency_code: "czk",
    items: [
      {
        id: "li_1",
        title: "Domovní číslo",
        product_title: "Domovní číslo s levandulí",
        thumbnail: null,
        metadata: { made_to_order: { specification: "číslo 12" } },
      },
    ],
    customer: { first_name: "Jana", last_name: "Nováková" },
    payment_collections: [
      {
        metadata: {
          made_to_order: true,
          production_lines: [{ production_time_max_days: 42 }],
        },
      },
    ],
  }
  const container = {
    resolve: (key: string) => {
      switch (key) {
        case "madeToOrder":
        case "made-to-order":
        case "madeToOrderModuleService":
          return madeToOrder
        case "query":
          return { graph: async () => ({ data: [order] }) }
        case "notification":
          return notifications
        case "logger":
          return logger
        default:
          throw new Error(`Neznámá registrace: ${key}`)
      }
    },
  }
  return { container: container as never, madeToOrder, notifications, updates, logger, current: () => current }
}

// Klíč modulu zakázek v kontejneru (ať test nespoléhá na konkrétní řetězec).
jest.mock("../../modules/made-to-order", () => ({
  MADE_TO_ORDER_MODULE: "madeToOrder",
}))

const productionOrder = {
  id: "po_1",
  order_id: "order_1",
  stage: "confirmed",
  deposit_percentage: 25,
  deposit_amount: 1250,
  original_total: 5000,
  currency_code: "czk",
  estimated_completion_at: null,
  production_started_at: null,
  production_start_notified_at: null,
}

beforeEach(() => {
  sendMock.mockReset()
})

describe("startProduction — Z3", () => {
  it("odeslaný e-mail → in_production + čas a id notifikace; e-mail nese datum, zálohu a lhůtu", async () => {
    sendMock.mockResolvedValue(true)
    const ctx = makeContainer({
      productionOrder,
      notifications: [{ id: "noti_1", status: "success" }],
    })

    const result = await startProduction(ctx.container, {
      productionOrder,
      orderId: "order_1",
    })

    expect(result.email_sent).toBe(true)
    expect(result.already_notified).toBe(false)
    expect(sendMock).toHaveBeenCalledTimes(1)
    const input = sendMock.mock.calls[0][1]
    expect(input.template).toBe("production-started")
    expect(input.key).toBe("mto-start:po_1")
    expect(input.to).toBe("jana@example.com")
    expect(input.data.productTitle).toBe("Domovní číslo s levandulí")
    expect(String(input.data.startedAtText)).toMatch(/^\d{1,2}\. \d{1,2}\. \d{4} v \d{2}:\d{2}$/)
    expect(String(input.data.depositAmount)).toMatch(/1\s?250/)
    expect(input.data.depositPercentage).toBe("25")
    expect(String(input.data.estimatedCompletion)).toMatch(/do 42 dnů od zahájení výroby/)

    const final = ctx.current()
    expect(final.stage).toBe("in_production")
    expect(final.production_started_at).toBeInstanceOf(Date)
    expect(final.production_start_notified_at).toBeInstanceOf(Date)
    expect(final.production_start_email_id).toBe("noti_1")
  })

  it("e-mail selže → fáze zpátky na confirmed, production_started_at null, česká chyba", async () => {
    sendMock.mockRejectedValue(new Error("Resend: 429"))
    const ctx = makeContainer({ productionOrder })

    await expect(
      startProduction(ctx.container, { productionOrder, orderId: "order_1" })
    ).rejects.toMatchObject({ message: PRODUCTION_START_EMAIL_FAILED, type: MedusaError.Types.NOT_ALLOWED })

    const final = ctx.current()
    expect(final.stage).toBe("confirmed")
    expect(final.production_started_at).toBeNull()
    expect(final.production_start_notified_at).toBeNull()
    expect(ctx.logger.warn).toHaveBeenCalled()
  })

  it("notifikace zapsaná jako failure (poskytovatel odmítl) = neodesláno", async () => {
    sendMock.mockResolvedValue(true)
    const ctx = makeContainer({
      productionOrder,
      notifications: [{ id: "noti_2", status: "failure" }],
    })

    await expect(
      startProduction(ctx.container, { productionOrder, orderId: "order_1" })
    ).rejects.toMatchObject({ message: PRODUCTION_START_EMAIL_FAILED })
    expect(ctx.current().stage).toBe("confirmed")
  })

  it("objednávka bez e-mailu (sendCustomerEmail vrátí false) = neodesláno", async () => {
    sendMock.mockResolvedValue(false)
    const ctx = makeContainer({ productionOrder })
    await expect(
      startProduction(ctx.container, { productionOrder, orderId: "order_1" })
    ).rejects.toMatchObject({ message: PRODUCTION_START_EMAIL_FAILED })
    expect(ctx.current().stage).toBe("confirmed")
  })

  it("idempotence: e-mail už odešel → nic se neposílá, jen se srovná fáze", async () => {
    const notified = {
      ...productionOrder,
      stage: "confirmed",
      production_start_notified_at: "2026-10-20T12:00:00.000Z",
      production_started_at: "2026-10-20T12:00:00.000Z",
    }
    const ctx = makeContainer({ productionOrder: notified })

    const result = await startProduction(ctx.container, {
      productionOrder: notified,
      orderId: "order_1",
    })

    expect(result.already_notified).toBe(true)
    expect(result.email_sent).toBe(false)
    expect(sendMock).not.toHaveBeenCalled()
    expect(ctx.current().stage).toBe("in_production")
  })

  it("mimo confirmed/in_production se nezahajuje", async () => {
    const ctx = makeContainer({ productionOrder: { ...productionOrder, stage: "awaiting_balance" } })
    await expect(
      startProduction(ctx.container, {
        productionOrder: { ...productionOrder, stage: "awaiting_balance" },
        orderId: "order_1",
      })
    ).rejects.toMatchObject({ type: MedusaError.Types.NOT_ALLOWED })
    expect(sendMock).not.toHaveBeenCalled()
  })
})

describe("estimatedCompletionText / productionMaxDaysOf", () => {
  const started = new Date("2026-10-20T10:00:00.000Z")

  it("zadaný termín má přednost", () => {
    expect(
      estimatedCompletionText({ estimated_completion_at: "2026-11-30T00:00:00.000Z" }, 42, started)
    ).toBe("30. 11. 2026")
  })

  it("bez termínu: „do N dnů od zahájení (nejpozději …)“ z profilu, bez obojího null", () => {
    expect(estimatedCompletionText({ estimated_completion_at: null }, 42, started)).toBe(
      "do 42 dnů od zahájení výroby (nejpozději 1. 12. 2026)"
    )
    expect(estimatedCompletionText({ estimated_completion_at: null }, null, started)).toBeNull()
  })

  it("lhůta ze snímku pokladny, jinak null", () => {
    expect(
      productionMaxDaysOf({
        payment_collections: [
          { metadata: { made_to_order: true, production_lines: [{ production_time_max_days: "35" }] } },
        ],
      })
    ).toBe(35)
    expect(productionMaxDaysOf({ payment_collections: [{ metadata: {} }] })).toBeNull()
    expect(productionMaxDaysOf(null)).toBeNull()
  })
})
