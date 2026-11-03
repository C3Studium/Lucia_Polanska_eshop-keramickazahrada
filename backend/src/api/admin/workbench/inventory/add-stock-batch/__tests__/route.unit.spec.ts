import { Modules } from "@medusajs/framework/utils"
import { POST as batchPOST } from "../route"
import { POST as undoPOST } from "../undo/route"
import { POST as singlePOST } from "../../add-stock/route"

/**
 * Naskladnění po výpalu přes skutečné handlery (bez databáze): tvar těla,
 * výběr skladového místa, dvojklik a vrácení. Pravidla samotná testuje
 * `lib/__tests__/add-stock.unit.spec.ts`.
 */

const sklad = (initial: Record<string, number>, locations = [{ id: "sloc_1" }]) => {
  const levels = new Map(
    Object.entries(initial).map(([id, stocked]) => [
      id,
      { stocked_quantity: stocked, reserved_quantity: 0 },
    ])
  )
  const inventory = {
    listInventoryLevels: async (f: any) => {
      const level = levels.get(f.inventory_item_id)
      return level ? [{ ...level, location_id: f.location_id }] : []
    },
    updateInventoryLevels: async (rows: any[]) => {
      for (const row of rows) levels.get(row.inventory_item_id)!.stocked_quantity = row.stocked_quantity
    },
    createInventoryLevels: async (rows: any[]) => {
      for (const row of rows) {
        levels.set(row.inventory_item_id, { stocked_quantity: row.stocked_quantity, reserved_quantity: 0 })
      }
    },
  }
  const scope = {
    resolve: (key: string) => {
      if (key === Modules.INVENTORY) return inventory
      if (key === Modules.STOCK_LOCATION) return { listStockLocations: async () => locations }
      throw new Error(`Could not resolve '${key}'`)
    },
  }
  return { levels, req: (body: unknown) => ({ scope, body }) as any }
}

const response = () => {
  const res: any = {}
  res.status = jest.fn((code: number) => {
    res.statusCode = code
    return res
  })
  res.json = jest.fn((body: unknown) => {
    res.body = body
    return res
  })
  return res
}

const id = () => `test-${Math.random().toString(36).slice(2)}`

describe("POST /admin/workbench/inventory/add-stock-batch", () => {
  it("přičte víc položek naráz a vrátí přehled", async () => {
    const { levels, req } = sklad({ a: 2, b: 0 })
    const res = response()
    await batchPOST(
      req({
        request_id: id(),
        items: [
          { inventory_item_id: "a", quantity: 3 },
          { inventory_item_id: "b", quantity: 1 },
          { inventory_item_id: "nova", quantity: 5 },
        ],
      }),
      res
    )
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ added_total: 9, ok_count: 3, failed_count: 0, location_id: "sloc_1" })
    expect(levels.get("a")!.stocked_quantity).toBe(5)
    expect(levels.get("nova")!.stocked_quantity).toBe(5)
  })

  it("dvojklik se stejným id nepřičte podruhé", async () => {
    const { levels, req } = sklad({ a: 0 })
    const body = { request_id: id(), items: [{ inventory_item_id: "a", quantity: 4 }] }
    await batchPOST(req(body), response())
    const res = response()
    await batchPOST(req(body), res)
    expect(res.body.replayed).toBe(true)
    expect(levels.get("a")!.stocked_quantity).toBe(4)
  })

  it.each([
    [{}],
    [{ request_id: "kratke", items: [{ inventory_item_id: "a", quantity: 1 }] }],
    [{ request_id: id(), items: [] }],
    [{ request_id: id(), items: [{ inventory_item_id: "a", quantity: 1.5 }] }],
    [{ request_id: id(), items: [{ inventory_item_id: "a", quantity: -1 }] }],
  ])("špatné tělo odmítne česky (%j)", async (body) => {
    const { req } = sklad({ a: 0 })
    await expect(batchPOST(req(body), response())).rejects.toThrow(/celý počet kusů/)
  })

  it("dvě skladová místa odmítne a nic nezapíše; po opravě jde stejná dávka znovu", async () => {
    const two = sklad({ a: 0 }, [{ id: "x" }, { id: "y" }])
    const body = { request_id: id(), items: [{ inventory_item_id: "a", quantity: 2 }] }
    await expect(batchPOST(two.req(body), response())).rejects.toThrow(/víc skladových míst/)
    expect(two.levels.get("a")!.stocked_quantity).toBe(0)

    const one = sklad({ a: 0 })
    const res = response()
    await batchPOST(one.req(body), res)
    expect(res.body.ok_count).toBe(1)
  })
})

describe("POST /admin/workbench/inventory/add-stock-batch/undo", () => {
  it("vrátí přesně naskladněné kusy a podruhé už neodečte", async () => {
    const { levels, req } = sklad({ a: 1 })
    const requestId = id()
    await batchPOST(req({ request_id: requestId, items: [{ inventory_item_id: "a", quantity: 3 }] }), response())
    expect(levels.get("a")!.stocked_quantity).toBe(4)

    const res = response()
    await undoPOST(req({ request_id: requestId }), res)
    expect(res.body).toMatchObject({ removed_total: 3, ok_count: 1, skipped_count: 0 })
    expect(levels.get("a")!.stocked_quantity).toBe(1)

    const again = response()
    await undoPOST(req({ request_id: requestId }), again)
    expect(again.body.replayed).toBe(true)
    expect(levels.get("a")!.stocked_quantity).toBe(1)
  })

  it("neznámou dávku odmítne česky", async () => {
    const { req } = sklad({ a: 1 })
    await expect(undoPOST(req({ request_id: id() }), response())).rejects.toThrow(/už vrátit nejde/)
  })
})

describe("POST /admin/workbench/inventory/add-stock (jedna položka, po přesunu do lib)", () => {
  it("přičte a vrátí stejný tvar odpovědi jako dřív", async () => {
    const { levels, req } = sklad({ a: 2 })
    const res = response()
    await singlePOST(req({ inventory_item_id: "a", quantity: 6 }), res)
    expect(res.body).toEqual({
      inventory_item_id: "a",
      location_id: "sloc_1",
      added: 6,
      stocked_quantity: 8,
    })
    expect(levels.get("a")!.stocked_quantity).toBe(8)
  })

  it("založí úroveň u nikdy nenaskladněné položky", async () => {
    const { levels, req } = sklad({})
    const res = response()
    await singlePOST(req({ inventory_item_id: "nova", quantity: 2 }), res)
    expect(res.body.stocked_quantity).toBe(2)
    expect(levels.get("nova")!.stocked_quantity).toBe(2)
  })

  it("bez skladového místa odmítne česky", async () => {
    const { req } = sklad({ a: 0 }, [])
    await expect(singlePOST(req({ inventory_item_id: "a", quantity: 1 }), response())).rejects.toThrow(
      /žádné skladové místo/
    )
  })
})
