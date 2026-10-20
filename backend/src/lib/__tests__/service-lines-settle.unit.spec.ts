import { SERVICE_LINE_REFERENCE, settleServiceLines } from "../service-lines-settle"

/**
 * Balné po odeslání zboží: jen zápis v modulu objednávek (registerFulfillment
 * + registerShipment), žádné plnění u dopravce a žádný e-mail.
 */
const containerWith = (order: any) => {
  const orderModule = {
    registerFulfillment: jest.fn().mockResolvedValue(undefined),
    registerShipment: jest.fn().mockResolvedValue(undefined),
  }
  const query = { graph: jest.fn().mockResolvedValue({ data: order ? [order] : [] }) }
  const container = {
    resolve: (key: string) => (key === "query" ? query : key === "order" ? orderModule : undefined),
  }
  return { container, orderModule, query }
}

const balne = (detail: Record<string, number> = {}) => ({
  id: "b",
  quantity: 2,
  requires_shipping: false,
  variant_id: null,
  product_id: null,
  metadata: { packaging_fee: true },
  detail,
})
const product = { id: "z", quantity: 1, requires_shipping: true, variant_id: "v", product_id: "p", detail: {} }

describe("settleServiceLines", () => {
  it("vyskladní a odešle balné, s odkazem na servisní řádek a bez notifikace", async () => {
    const { container, orderModule } = containerWith({ id: "o1", status: "pending", items: [product, balne()] })
    await expect(settleServiceLines(container, "o1")).resolves.toEqual({ fulfilled: 2, shipped: 2 })
    expect(orderModule.registerFulfillment).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "o1", reference: SERVICE_LINE_REFERENCE, items: [{ id: "b", quantity: 2 }] })
    )
    expect(orderModule.registerShipment).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "o1", no_notification: true, items: [{ id: "b", quantity: 2 }] })
    )
    // Zboží se tu nezapisuje — to má vlastní plnění u dopravce.
    const items = orderModule.registerFulfillment.mock.calls[0][0].items
    expect(items.some((item: any) => item.id === "z")).toBe(false)
  })

  it("nic nezbývá → nic nevolá (idempotentní)", async () => {
    const { container, orderModule } = containerWith({
      id: "o1",
      status: "completed",
      items: [balne({ fulfilled_quantity: 2, shipped_quantity: 2 })],
    })
    await expect(settleServiceLines(container, "o1")).resolves.toEqual({ fulfilled: 0, shipped: 0 })
    expect(orderModule.registerFulfillment).not.toHaveBeenCalled()
    expect(orderModule.registerShipment).not.toHaveBeenCalled()
  })

  it("zrušenou objednávku nechá být", async () => {
    const { container, orderModule } = containerWith({ id: "o1", status: "canceled", items: [balne()] })
    await expect(settleServiceLines(container, "o1")).resolves.toEqual({ fulfilled: 0, shipped: 0 })
    expect(orderModule.registerFulfillment).not.toHaveBeenCalled()
  })

  it("vyskladněné balné jen odešle", async () => {
    const { container, orderModule } = containerWith({
      id: "o1",
      status: "pending",
      items: [balne({ fulfilled_quantity: 2 })],
    })
    await expect(settleServiceLines(container, "o1")).resolves.toEqual({ fulfilled: 0, shipped: 2 })
    expect(orderModule.registerFulfillment).not.toHaveBeenCalled()
    expect(orderModule.registerShipment).toHaveBeenCalledTimes(1)
  })
})
