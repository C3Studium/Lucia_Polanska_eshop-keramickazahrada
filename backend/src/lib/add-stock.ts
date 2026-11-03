import { MedusaError, Modules } from "@medusajs/framework/utils"

/**
 * Přičítání kusů na sklad — jedno místo pro jednu položku i pro celou pec.
 *
 * Pravidlo (Matěj, 2026-08-06): ona řekne, KOLIK kusů vyšlo z pece, zbytek
 * je náš problém. Jedno skladové místo → použije se samo, úroveň se založí,
 * když ještě nikdy neexistovala. Dvě místa → zdvořile odmítneme, místo abychom
 * hádali, kam šest hrnků patří.
 *
 * Dávka po výpalu (3. 11. 2026) jde po jedné položce s výsledkem u každé:
 * když jedna selže, ostatní zůstanou naskladněné a ona vidí, co zopakovat.
 * Celou dávku v jedné transakci by modul zásob nesvedl (úprava a založení
 * úrovně jsou dvě volání) a „nic se neuložilo" by po deseti vyplněných
 * řádcích bylo horší než „jeden řádek se nepovedl".
 */

type InventoryService = {
  listInventoryLevels: (filters: any, config?: any) => Promise<any[]>
  updateInventoryLevels: (input: any[]) => Promise<unknown>
  createInventoryLevels: (input: any[]) => Promise<unknown>
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  // BigNumber z některých projekcí chodí jako objekt.
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toNumber(candidate.value ?? candidate.numeric_ ?? 0)
  }
  return 0
}

/** Jediné skladové místo obchodu — nebo česká chyba, proč ho nevybereme. */
export const resolveRestockLocation = async (scope: {
  resolve: (key: string) => unknown
}): Promise<string> => {
  const stockLocations = scope.resolve(Modules.STOCK_LOCATION) as any
  const locations = (await stockLocations.listStockLocations({}, { take: 5 })) as any[]
  if (!locations.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Obchod nemá žádné skladové místo — založte ho v Nastavení → Místa a doprava."
    )
  }
  if (locations.length > 1) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Máte víc skladových míst — doplňte kusy ve skladu, ať skončí na tom správném."
    )
  }
  return locations[0].id
}

/*
 * Přičtení je čtení + zápis. Dvě souběžná přičtení ke stejné položce by se
 * přepsala (obě přečtou 3, obě zapíšou 3 + n), proto jdou všechna naskladnění
 * z adminu za sebou. Je to pár dotazů na položku, fronta nikoho nezdrží.
 */
let fronta: Promise<unknown> = Promise.resolve()
export const withStockLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = fronta.then(fn, fn)
  fronta = run.catch(() => undefined)
  return run
}

/** Přičte kusy jedné položce; úroveň založí, když ještě nebyla. */
export const addStockToItem = async (
  inventory: InventoryService,
  locationId: string,
  inventoryItemId: string,
  quantity: number
): Promise<{ previous: number; stocked_quantity: number; reserved: number }> => {
  const [level] = await inventory.listInventoryLevels({
    inventory_item_id: inventoryItemId,
    location_id: locationId,
  })

  if (level) {
    const previous = toNumber(level.stocked_quantity)
    await inventory.updateInventoryLevels([
      {
        inventory_item_id: inventoryItemId,
        location_id: locationId,
        stocked_quantity: previous + quantity,
      },
    ])
    return {
      previous,
      stocked_quantity: previous + quantity,
      reserved: toNumber(level.reserved_quantity),
    }
  }

  // Prvních pět kliknutí odpadá: první kusy nového výrobku prostě projdou.
  await inventory.createInventoryLevels([
    {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      stocked_quantity: quantity,
    },
  ])
  return { previous: 0, stocked_quantity: quantity, reserved: 0 }
}

export type RestockItemInput = { inventory_item_id: string; quantity: number }

export type RestockItemResult =
  | {
      inventory_item_id: string
      ok: true
      added: number
      stocked_quantity: number
      /** Kusy v objednávkách v okamžiku naskladnění — vrácení podle nich pozná, jestli se mezitím prodávalo. */
      reserved_at_restock?: number
    }
  | { inventory_item_id: string; ok: false; quantity: number; error: string }

export type RestockBatchResult = {
  request_id: string
  location_id: string
  results: RestockItemResult[]
  added_total: number
  ok_count: number
  failed_count: number
  /** Stejná dávka přišla podruhé (dvojklik, opakování po výpadku sítě). */
  replayed?: boolean
}

export type RestockUndoItemResult =
  | { inventory_item_id: string; ok: true; removed: number; stocked_quantity: number }
  | { inventory_item_id: string; ok: false; removed: 0; error: string }

export type RestockUndoResult = {
  request_id: string
  results: RestockUndoItemResult[]
  removed_total: number
  ok_count: number
  skipped_count: number
  replayed?: boolean
}

/** Stejná položka dvakrát v jedné dávce se sečte — jinak by druhý zápis přepsal první. */
export const mergeRestockItems = (items: RestockItemInput[]): RestockItemInput[] => {
  const merged = new Map<string, number>()
  for (const item of items) {
    merged.set(item.inventory_item_id, (merged.get(item.inventory_item_id) ?? 0) + item.quantity)
  }
  return [...merged].map(([inventory_item_id, quantity]) => ({ inventory_item_id, quantity }))
}

const fingerprintOf = (items: RestockItemInput[]) =>
  JSON.stringify(
    [...items]
      .sort((a, b) => a.inventory_item_id.localeCompare(b.inventory_item_id))
      .map((item) => [item.inventory_item_id, item.quantity])
  )

/** Česká hláška z chyby položky; anglickou nahradí obecnou. */
const itemError = (error: unknown, fallback: string): string => {
  const message = error instanceof Error ? error.message : ""
  return /[áčďéěíňóřšťúůýž]/i.test(message) ? message : fallback
}

export const runRestockBatch = async (
  inventory: InventoryService,
  locationId: string,
  requestId: string,
  items: RestockItemInput[]
): Promise<RestockBatchResult> => {
  const results: RestockItemResult[] = []
  for (const item of items) {
    try {
      const { stocked_quantity, reserved } = await addStockToItem(
        inventory,
        locationId,
        item.inventory_item_id,
        item.quantity
      )
      results.push({
        inventory_item_id: item.inventory_item_id,
        ok: true,
        added: item.quantity,
        stocked_quantity,
        reserved_at_restock: reserved,
      })
    } catch (error) {
      console.error("[add-stock-batch] položka selhala", item.inventory_item_id, error)
      results.push({
        inventory_item_id: item.inventory_item_id,
        ok: false,
        quantity: item.quantity,
        error: itemError(error, "Tuhle položku se nepodařilo naskladnit — zkuste to znovu."),
      })
    }
  }
  const ok = results.filter((result) => result.ok)
  return {
    request_id: requestId,
    location_id: locationId,
    results,
    added_total: ok.reduce((sum, result) => sum + (result.ok ? result.added : 0), 0),
    ok_count: ok.length,
    failed_count: results.length - ok.length,
  }
}

/**
 * Vrácení dávky: odečte přesně to, co dávka přičetla — nic víc.
 *
 * Odečítá, nezapisuje starý stav: když mezitím přišly kusy odjinud, zůstanou.
 * Položku, u které by odečtení šlo pod kusy v zaplacených objednávkách
 * (mezitím se z nové várky prodávalo) nebo pod nulu (někdo počet mezitím
 * přepsal ručně), nechá být a řekne to — hádat tady nechceme.
 */
export const revertRestockBatch = async (
  inventory: InventoryService,
  batch: RestockBatchResult
): Promise<RestockUndoResult> => {
  const results: RestockUndoItemResult[] = []
  for (const item of batch.results) {
    if (!item.ok) continue
    try {
      const [level] = await inventory.listInventoryLevels({
        inventory_item_id: item.inventory_item_id,
        location_id: batch.location_id,
      })
      if (!level) {
        results.push({
          inventory_item_id: item.inventory_item_id,
          ok: false,
          removed: 0,
          error: "Položka už na skladě není — upravte ji prosím ručně.",
        })
        continue
      }
      const stocked = toNumber(level.stocked_quantity)
      const reserved = toNumber(level.reserved_quantity)
      const target = stocked - item.added
      if (target < 0) {
        results.push({
          inventory_item_id: item.inventory_item_id,
          ok: false,
          removed: 0,
          error: "Počet kusů se mezitím změnil jinde — upravte ho prosím ručně.",
        })
        continue
      }
      // Prodávalo se z nové várky = od naskladnění přibyly kusy v objednávkách
      // a bez várky by na ně nezbylo. Samotné „sklad < objednané" nestačí:
      // u prodeje bez kusů na skladu je to běžný stav už před naskladněním.
      const reservedBefore = item.reserved_at_restock
      const soldSince = reservedBefore === undefined ? true : reserved > reservedBefore
      if (target < reserved && soldSince) {
        results.push({
          inventory_item_id: item.inventory_item_id,
          ok: false,
          removed: 0,
          error: "Z nových kusů se mezitím prodávalo — počet nechávám, upravte ho prosím ručně.",
        })
        continue
      }
      await inventory.updateInventoryLevels([
        {
          inventory_item_id: item.inventory_item_id,
          location_id: batch.location_id,
          stocked_quantity: target,
        },
      ])
      results.push({
        inventory_item_id: item.inventory_item_id,
        ok: true,
        removed: item.added,
        stocked_quantity: target,
      })
    } catch (error) {
      console.error("[add-stock-batch] vrácení položky selhalo", item.inventory_item_id, error)
      results.push({
        inventory_item_id: item.inventory_item_id,
        ok: false,
        removed: 0,
        error: itemError(error, "Tuhle položku se nepodařilo vrátit — upravte ji prosím ručně."),
      })
    }
  }
  const ok = results.filter((result) => result.ok)
  return {
    request_id: batch.request_id,
    results,
    removed_total: ok.reduce((sum, result) => sum + result.removed, 0),
    ok_count: ok.length,
    skipped_count: results.length - ok.length,
  }
}

/** Vrácení se nabízí 10 minut (admin/lib/undo.ts); minuta navíc na hodiny prohlížeče. */
export const RESTOCK_UNDO_WINDOW_MS = 11 * 60 * 1000
/** Jak dlouho si pamatujeme dávku proti dvojkliku. */
const RESTOCK_MEMORY_MS = 15 * 60 * 1000

type BatchRecord = {
  fingerprint: string
  at: number
  pending: Promise<RestockBatchResult>
  undo?: Promise<RestockUndoResult>
}

/**
 * Paměť dávek — v procesu, ne v databázi. Stačí to: chrání proti dvojkliku a
 * opakování během pár vteřin a vrácení je stejně jen na deset minut. Po
 * restartu serveru se stará dávka vrátit nedá (řekneme to), naskladnění zůstane.
 * Backend běží v jedné instanci (worker je sloučený s ním).
 */
export class RestockBatchRegistry {
  private records = new Map<string, BatchRecord>()
  constructor(private now: () => number = Date.now) {}

  private prune() {
    const limit = this.now() - RESTOCK_MEMORY_MS
    for (const [id, record] of this.records) {
      if (record.at < limit) this.records.delete(id)
    }
  }

  async submit(
    requestId: string,
    items: RestockItemInput[],
    run: (items: RestockItemInput[]) => Promise<RestockBatchResult>
  ): Promise<RestockBatchResult> {
    this.prune()
    const merged = mergeRestockItems(items)
    const fingerprint = fingerprintOf(merged)
    const existing = this.records.get(requestId)
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          "Tahle dávka už je uložená s jinými čísly — obnovte prosím stránku."
        )
      }
      return { ...(await existing.pending), replayed: true }
    }

    const pending = run(merged)
    this.records.set(requestId, { fingerprint, at: this.now(), pending })
    try {
      return await pending
    } catch (error) {
      // Celá dávka padla (třeba bez skladového místa) — nic se nezapsalo, smí se zopakovat.
      this.records.delete(requestId)
      throw error
    }
  }

  async undo(
    requestId: string,
    revert: (batch: RestockBatchResult) => Promise<RestockUndoResult>
  ): Promise<RestockUndoResult> {
    this.prune()
    const record = this.records.get(requestId)
    if (!record || this.now() - record.at > RESTOCK_UNDO_WINDOW_MS) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Tohle naskladnění už vrátit nejde — vrátit jde jen do deseti minut. Počty upravte prosím ručně."
      )
    }
    if (record.undo) {
      return { ...(await record.undo), replayed: true }
    }
    const batch = await record.pending
    record.undo = revert(batch)
    try {
      return await record.undo
    } catch (error) {
      record.undo = undefined
      throw error
    }
  }
}

export const restockBatches = new RestockBatchRegistry()
