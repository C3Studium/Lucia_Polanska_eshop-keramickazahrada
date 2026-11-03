import {
  RESTOCK_UNDO_WINDOW_MS,
  RestockBatchRegistry,
  addStockToItem,
  mergeRestockItems,
  revertRestockBatch,
  runRestockBatch,
  withStockLock,
} from "../add-stock"

/** Falešný modul zásob: úrovně v mapě, klíč = položka. */
const fakeInventory = (
  initial: Record<string, { stocked: number; reserved?: number }> = {},
  failOn: string[] = []
) => {
  const levels = new Map(
    Object.entries(initial).map(([id, level]) => [
      id,
      { stocked_quantity: level.stocked, reserved_quantity: level.reserved ?? 0 },
    ])
  )
  const calls = { update: 0, create: 0 }
  return {
    levels,
    calls,
    listInventoryLevels: async (filters: any) => {
      const level = levels.get(filters.inventory_item_id)
      return level ? [{ ...level, location_id: filters.location_id }] : []
    },
    updateInventoryLevels: async (input: any[]) => {
      for (const row of input) {
        if (failOn.includes(row.inventory_item_id)) throw new Error("db down")
        calls.update++
        const level = levels.get(row.inventory_item_id)!
        level.stocked_quantity = row.stocked_quantity
      }
    },
    createInventoryLevels: async (input: any[]) => {
      for (const row of input) {
        if (failOn.includes(row.inventory_item_id)) throw new Error("db down")
        calls.create++
        levels.set(row.inventory_item_id, {
          stocked_quantity: row.stocked_quantity,
          reserved_quantity: 0,
        })
      }
    },
  }
}

describe("addStockToItem", () => {
  it("přičte ke stávajícímu stavu", async () => {
    const inv = fakeInventory({ a: { stocked: 3 } })
    const result = await addStockToItem(inv, "loc", "a", 6)
    expect(result).toEqual({ previous: 3, stocked_quantity: 9, reserved: 0 })
    expect(inv.levels.get("a")!.stocked_quantity).toBe(9)
  })

  it("založí úroveň u nikdy nenaskladněné položky", async () => {
    const inv = fakeInventory()
    const result = await addStockToItem(inv, "loc", "new", 2)
    expect(result.stocked_quantity).toBe(2)
    expect(inv.calls.create).toBe(1)
  })

  it("přečte stav i jako text nebo BigNumber", async () => {
    const inv = fakeInventory()
    inv.levels.set("s", { stocked_quantity: "4" as any, reserved_quantity: 0 })
    inv.levels.set("b", { stocked_quantity: { value: "5" } as any, reserved_quantity: 0 })
    expect((await addStockToItem(inv, "loc", "s", 1)).stocked_quantity).toBe(5)
    expect((await addStockToItem(inv, "loc", "b", 1)).stocked_quantity).toBe(6)
  })
})

describe("mergeRestockItems", () => {
  it("sečte stejnou položku zadanou dvakrát", () => {
    expect(
      mergeRestockItems([
        { inventory_item_id: "a", quantity: 2 },
        { inventory_item_id: "b", quantity: 1 },
        { inventory_item_id: "a", quantity: 3 },
      ])
    ).toEqual([
      { inventory_item_id: "a", quantity: 5 },
      { inventory_item_id: "b", quantity: 1 },
    ])
  })
})

describe("runRestockBatch", () => {
  it("naskladní všechno a sečte kusy", async () => {
    const inv = fakeInventory({ a: { stocked: 1 }, b: { stocked: 0 } })
    const result = await runRestockBatch(inv, "loc", "req-12345", [
      { inventory_item_id: "a", quantity: 4 },
      { inventory_item_id: "b", quantity: 2 },
      { inventory_item_id: "c", quantity: 3 },
    ])
    expect(result.added_total).toBe(9)
    expect(result.ok_count).toBe(3)
    expect(result.failed_count).toBe(0)
    expect(inv.levels.get("a")!.stocked_quantity).toBe(5)
    expect(inv.levels.get("c")!.stocked_quantity).toBe(3)
  })

  it("selhání jedné položky nezastaví ostatní a má českou hlášku", async () => {
    const inv = fakeInventory({ a: { stocked: 1 }, b: { stocked: 1 } }, ["a"])
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
    const result = await runRestockBatch(inv, "loc", "req-12345", [
      { inventory_item_id: "a", quantity: 4 },
      { inventory_item_id: "b", quantity: 2 },
    ])
    errorSpy.mockRestore()
    expect(result.ok_count).toBe(1)
    expect(result.failed_count).toBe(1)
    expect(result.added_total).toBe(2)
    const failed = result.results.find((r) => !r.ok)!
    expect(failed.ok).toBe(false)
    if (!failed.ok) {
      expect(failed.error).toMatch(/nepodařilo naskladnit/)
      expect(failed.quantity).toBe(4)
    }
    expect(inv.levels.get("b")!.stocked_quantity).toBe(3)
  })
})

describe("RestockBatchRegistry — dvojklik", () => {
  const items = [
    { inventory_item_id: "a", quantity: 4 },
    { inventory_item_id: "b", quantity: 1 },
  ]

  it("stejná dávka podruhé nic nepřičte", async () => {
    const inv = fakeInventory({ a: { stocked: 0 }, b: { stocked: 0 } })
    const registry = new RestockBatchRegistry()
    const run = (merged: typeof items) => runRestockBatch(inv, "loc", "req-12345", merged)
    const first = await registry.submit("req-12345", items, run)
    const second = await registry.submit("req-12345", [...items].reverse(), run)
    expect(first.replayed).toBeUndefined()
    expect(second.replayed).toBe(true)
    expect(inv.levels.get("a")!.stocked_quantity).toBe(4)
  })

  it("souběžný dvojklik čeká na první várku", async () => {
    const inv = fakeInventory({ a: { stocked: 0 }, b: { stocked: 0 } })
    const registry = new RestockBatchRegistry()
    const run = (merged: typeof items) =>
      withStockLock(() => runRestockBatch(inv, "loc", "req-12345", merged))
    const [one, two] = await Promise.all([
      registry.submit("req-12345", items, run),
      registry.submit("req-12345", items, run),
    ])
    expect(inv.levels.get("a")!.stocked_quantity).toBe(4)
    expect([one.replayed, two.replayed]).toContain(true)
  })

  it("stejné id s jinými čísly odmítne", async () => {
    const inv = fakeInventory({ a: { stocked: 0 }, b: { stocked: 0 } })
    const registry = new RestockBatchRegistry()
    const run = (merged: typeof items) => runRestockBatch(inv, "loc", "req-12345", merged)
    await registry.submit("req-12345", items, run)
    await expect(
      registry.submit("req-12345", [{ inventory_item_id: "a", quantity: 9 }], run)
    ).rejects.toThrow(/jinými čísly/)
  })

  it("po pádu celé dávky jde zopakovat", async () => {
    const registry = new RestockBatchRegistry()
    await expect(
      registry.submit("req-12345", items, async () => {
        throw new Error("Obchod nemá žádné skladové místo")
      })
    ).rejects.toThrow()
    const inv = fakeInventory({ a: { stocked: 0 }, b: { stocked: 0 } })
    const result = await registry.submit("req-12345", items, (merged) =>
      runRestockBatch(inv, "loc", "req-12345", merged)
    )
    expect(result.ok_count).toBe(2)
  })
})

describe("vrácení dávky", () => {
  const setup = async (initial: Record<string, { stocked: number; reserved?: number }>) => {
    let now = 1_000_000
    const registry = new RestockBatchRegistry(() => now)
    const inv = fakeInventory(initial)
    await registry.submit(
      "req-12345",
      Object.keys(initial).map((id) => ({ inventory_item_id: id, quantity: 3 })),
      (merged) => runRestockBatch(inv, "loc", "req-12345", merged)
    )
    return { registry, inv, tick: (ms: number) => (now += ms) }
  }

  it("odečte přesně přičtené kusy, i když mezitím přibyly další", async () => {
    const { registry, inv } = await setup({ a: { stocked: 2 } })
    inv.levels.get("a")!.stocked_quantity += 1 // kus odjinud po naskladnění
    const result = await registry.undo("req-12345", (batch) => revertRestockBatch(inv, batch))
    expect(result.removed_total).toBe(3)
    expect(inv.levels.get("a")!.stocked_quantity).toBe(3)
  })

  it("podruhé už neodečítá", async () => {
    const { registry, inv } = await setup({ a: { stocked: 2 } })
    await registry.undo("req-12345", (batch) => revertRestockBatch(inv, batch))
    const again = await registry.undo("req-12345", (batch) => revertRestockBatch(inv, batch))
    expect(again.replayed).toBe(true)
    expect(inv.levels.get("a")!.stocked_quantity).toBe(2)
  })

  it("nechá položku, ze které se mezitím prodávalo", async () => {
    const { registry, inv } = await setup({ a: { stocked: 0 }, b: { stocked: 1 } })
    inv.levels.get("a")!.reserved_quantity = 2
    const result = await registry.undo("req-12345", (batch) => revertRestockBatch(inv, batch))
    expect(result.ok_count).toBe(1)
    expect(result.skipped_count).toBe(1)
    expect(inv.levels.get("a")!.stocked_quantity).toBe(3)
    expect(inv.levels.get("b")!.stocked_quantity).toBe(1)
  })

  it("vrátí i u zboží prodávaného bez kusů na skladu, když se mezitím nic neprodalo", async () => {
    // Objednáno 5 kusů, skladem 0 (prodej bez kusů na skladu) — naskladnění
    // a hned vrácení nesmí hlásit „prodávalo se": objednávky tam byly už předtím.
    const { registry, inv } = await setup({ a: { stocked: 0, reserved: 5 } })
    const result = await registry.undo("req-12345", (batch) => revertRestockBatch(inv, batch))
    expect(result.ok_count).toBe(1)
    expect(inv.levels.get("a")!.stocked_quantity).toBe(0)
  })

  it("nejde pod nulu, když někdo počet mezitím přepsal", async () => {
    const { registry, inv } = await setup({ a: { stocked: 0 } })
    inv.levels.get("a")!.stocked_quantity = 1
    const result = await registry.undo("req-12345", (batch) => revertRestockBatch(inv, batch))
    expect(result.ok_count).toBe(0)
    expect(inv.levels.get("a")!.stocked_quantity).toBe(1)
  })

  it("po deseti minutách už nevrací", async () => {
    const { registry, inv, tick } = await setup({ a: { stocked: 0 } })
    tick(RESTOCK_UNDO_WINDOW_MS + 1)
    await expect(
      registry.undo("req-12345", (batch) => revertRestockBatch(inv, batch))
    ).rejects.toThrow(/už vrátit nejde/)
    expect(inv.levels.get("a")!.stocked_quantity).toBe(3)
  })

  it("neznámou dávku nevrací", async () => {
    const registry = new RestockBatchRegistry()
    await expect(
      registry.undo("req-nikdy", async () => {
        throw new Error("nemá se volat")
      })
    ).rejects.toThrow(/už vrátit nejde/)
  })
})
