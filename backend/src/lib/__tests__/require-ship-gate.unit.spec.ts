import { requireShipGate } from "../require-ship-gate"

/**
 * A fake container whose `query.graph` answers by entity, so the guard can be
 * driven through its real code path without a database.
 */
const scopeWith = (data: {
  order?: unknown
  production_order?: unknown[]
  order_change?: unknown[]
}) => ({
  resolve: (key: string) => {
    if (key === "query") {
      return {
        graph: async ({ entity }: { entity: string }) => {
          if (entity === "order") {
            return { data: data.order ? [data.order] : [] }
          }
          if (entity === "production_order") {
            return { data: data.production_order ?? [] }
          }
          if (entity === "order_change") {
            return { data: data.order_change ?? [] }
          }
          throw new Error(`Unexpected entity ${entity}`)
        },
      }
    }
    throw new Error(`Unexpected resolve("${key}")`)
  },
})

const paidOrder = {
  id: "order_1",
  currency_code: "czk",
  total: 1890,
  summary: { pending_difference: 0 },
  payment_collections: [
    {
      status: "completed",
      amount: 1890,
      captured_amount: 1890,
      refunded_amount: 0,
    },
  ],
}

const run = async (scope: unknown, params: Record<string, string>) => {
  const calls: unknown[] = []
  const next = (error?: unknown) => calls.push(error)

  await requireShipGate()(
    { scope, params } as never,
    {} as never,
    next as never
  )

  return calls[0]
}

describe("requireShipGate", () => {
  it("lets a fully paid order through", async () => {
    const error = await run(scopeWith({ order: paidOrder }), { id: "order_1" })
    expect(error).toBeUndefined()
  })

  it("blocks a fulfilment for an unpaid order", async () => {
    const error = await run(
      scopeWith({
        order: {
          ...paidOrder,
          payment_collections: [
            {
              status: "not_paid",
              amount: 1890,
              captured_amount: 0,
              refunded_amount: 0,
            },
          ],
        },
      }),
      { id: "order_1" }
    )

    // The native order page is the bypass this guard exists to close.
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/není celá zaplacená/i)
  })

  it("blocks while an order edit is still open", async () => {
    const error = await run(
      scopeWith({
        order: paidOrder,
        order_change: [{ id: "ordch_1", status: "pending" }],
      }),
      { id: "order_1" }
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/úprava/i)
  })

  it("blocks a commission that still owes a balance", async () => {
    const error = await run(
      scopeWith({
        order: paidOrder,
        production_order: [
          {
            agreed_total: 6000,
            original_total: 6000,
            payment_requests: [{ status: "paid", amount: 1500 }],
          },
        ],
      }),
      { id: "order_1" }
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/doplat/i)
  })

  it("fails closed when the order cannot be found", async () => {
    const error = await run(scopeWith({}), { id: "order_missing" })
    expect(error).toBeInstanceOf(Error)
  })

  it("fails closed when the route carries no order id", async () => {
    // If the native route ever changes shape, refusing is the safe direction.
    const error = await run(scopeWith({ order: paidOrder }), {})
    expect(error).toBeInstanceOf(Error)
  })
})
