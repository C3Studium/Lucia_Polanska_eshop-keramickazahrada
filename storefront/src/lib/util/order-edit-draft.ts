import type {
  EditAction,
  EditableItem,
  OrderEditContext,
} from "@lib/data/order-edit"

/**
 * Rozpracovaná úprava objednávky — co si zákazník naklikal, ale ještě
 * neuložil.
 *
 * Žije v klientském stavu stránky úpravy A zároveň v `sessionStorage`: cesta do
 * mini obchodu (`/order/:id/edit/pridat`) je změna routy, stránka úpravy se
 * odpojí a s ní by zmizelo všechno, co si zákazník mezitím nastavil. Session,
 * ne local: návrh má přežít přechod mezi stránkami, ne zítřek — zítra může být
 * objednávka zabalená a návrh by jen mátl.
 *
 * Návrh je jen přání. Při načtení ho stránka úpravy srovná s aktuálním
 * kontextem (`sanitizeDraft`) a o všem nakonec rozhoduje server.
 */

/** Kontrakt §5: max 30 akcí, max 1 akce na řádek. */
export const MAX_EDIT_ACTIONS = 30
/** Kontrakt §5: `add` 1–20 kusů. */
export const MAX_ADD_QUANTITY = 20
/** Kontrakt §5: `set_quantity` 1–99 kusů. */
export const MAX_SET_QUANTITY = 99

/**
 * Výměna za JINÝ výrobek (§3d.10) — snímek nového výrobku pro zobrazení
 * v řádku („→ Miska · modrá"). Na server jde jen `variant_id`; cena je
 * popisek, rozdíl spočítá server v náhledu.
 */
export type DraftSwapTarget = {
  product_id: string
  handle: string | null
  title: string
  variant_title: string | null
  thumbnail: string | null
  unit_price: number | null
}

/** Jedna změna na řádek objednávky — víc kontrakt nedovolí. */
export type DraftLineChange =
  /** Bez `product` = jiná varianta téhož výrobku (z `item.variants`);
      s `product` = výměna za jiný výrobek z mini obchodu. */
  | { type: "swap"; variant_id: string; product?: DraftSwapTarget }
  | { type: "remove" }
  | { type: "set_quantity"; quantity: number }

/**
 * Kus přidaný z mini obchodu. Kromě `variant_id` a počtu (to jde na server)
 * nese snímek pro zobrazení — název, náhled, cenu z chvíle výběru. Cena je jen
 * popisek; skutečný rozdíl spočítá server v náhledu.
 */
export type DraftAdd = {
  variant_id: string
  quantity: number
  product_id: string
  handle: string | null
  title: string
  variant_title: string | null
  thumbnail: string | null
  unit_price: number | null
  /** Strop stepperu: sklad, nejvýš `MAX_ADD_QUANTITY`. */
  max_quantity: number
}

export type OrderEditDraft = {
  lines: Record<string, DraftLineChange>
  adds: DraftAdd[]
}

export const emptyDraft = (): OrderEditDraft => ({ lines: {}, adds: [] })

const keyFor = (orderId: string) => `order-edit-draft:${orderId}`

const clampInt = (value: unknown, min: number, max: number) =>
  Math.min(Math.max(min, Math.floor(Number(value) || min)), Math.max(min, max))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null)

const parseSwapTarget = (raw: unknown): DraftSwapTarget | undefined => {
  if (!isRecord(raw) || typeof raw.product_id !== "string") return undefined
  return {
    product_id: raw.product_id,
    handle: stringOrNull(raw.handle),
    title: typeof raw.title === "string" ? raw.title : "Jiný výrobek",
    variant_title: stringOrNull(raw.variant_title),
    thumbnail: stringOrNull(raw.thumbnail),
    unit_price:
      typeof raw.unit_price === "number" && Number.isFinite(raw.unit_price)
        ? raw.unit_price
        : null,
  }
}

const TOO_MANY_CHANGES =
  "Víc změn najednou uložit nejde. Uložte prosím nejdřív ty rozpracované a pak pokračujte."
const STORAGE_BLOCKED =
  "Prohlížeč nám nedovolil volbu uložit (soukromé okno nebo vypnuté úložiště). Zkuste to prosím v běžném okně, nebo nám napište, co změnit."

/** Ze `sessionStorage` může přijít cokoli (starší tvar, ruční zásah) — bereme
    jen to, co tvarem sedí, zbytek tiše zahodíme. */
const parseDraft = (raw: unknown): OrderEditDraft => {
  const draft = emptyDraft()
  if (!isRecord(raw)) return draft

  if (isRecord(raw.lines)) {
    for (const [itemId, change] of Object.entries(raw.lines)) {
      if (!isRecord(change)) continue
      if (change.type === "remove") {
        draft.lines[itemId] = { type: "remove" }
      } else if (change.type === "swap" && typeof change.variant_id === "string") {
        const product = parseSwapTarget(change.product)
        draft.lines[itemId] = product
          ? { type: "swap", variant_id: change.variant_id, product }
          : { type: "swap", variant_id: change.variant_id }
      } else if (change.type === "set_quantity") {
        draft.lines[itemId] = {
          type: "set_quantity",
          quantity: clampInt(change.quantity, 1, MAX_SET_QUANTITY),
        }
      }
    }
  }

  if (Array.isArray(raw.adds)) {
    for (const add of raw.adds) {
      if (!isRecord(add)) continue
      if (typeof add.variant_id !== "string" || typeof add.product_id !== "string") {
        continue
      }
      const max = clampInt(add.max_quantity, 1, MAX_ADD_QUANTITY)
      draft.adds.push({
        variant_id: add.variant_id,
        product_id: add.product_id,
        quantity: clampInt(add.quantity, 1, max),
        max_quantity: max,
        handle: typeof add.handle === "string" ? add.handle : null,
        title: typeof add.title === "string" ? add.title : "Přidaný kus",
        variant_title:
          typeof add.variant_title === "string" ? add.variant_title : null,
        thumbnail: typeof add.thumbnail === "string" ? add.thumbnail : null,
        unit_price:
          typeof add.unit_price === "number" && Number.isFinite(add.unit_price)
            ? add.unit_price
            : null,
      })
    }
  }

  return draft
}

/** Přečte návrh; soukromé okno / zakázané úložiště = prázdný návrh, ne pád. */
export function readDraft(orderId: string): OrderEditDraft {
  if (typeof window === "undefined") return emptyDraft()
  try {
    const raw = window.sessionStorage.getItem(keyFor(orderId))
    return raw ? parseDraft(JSON.parse(raw)) : emptyDraft()
  } catch {
    return emptyDraft()
  }
}

/**
 * Uloží návrh; prázdný klíč rovnou smaže, ať po uložení nic nestraší.
 * Vrací, jestli se zápis povedl — mini obchod bez úložiště nemá jak kus
 * předat zpátky na stránku úpravy a musí to zákazníkovi říct.
 */
export function writeDraft(orderId: string, draft: OrderEditDraft): boolean {
  if (typeof window === "undefined") return false
  try {
    if (draftActionCount(draft) === 0) {
      window.sessionStorage.removeItem(keyFor(orderId))
    } else {
      window.sessionStorage.setItem(keyFor(orderId), JSON.stringify(draft))
    }
    return true
  } catch {
    /* Bez úložiště se jen ztratí návrh při cestě do mini obchodu — stránka
       úpravy dál funguje. */
    return false
  }
}

export function clearDraft(orderId: string) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(keyFor(orderId))
  } catch {
    /* viz writeDraft */
  }
}

export const draftActionCount = (draft: OrderEditDraft) =>
  Object.keys(draft.lines).length + draft.adds.length

/** Návrh → akce pro server (kontrakt §5). Nejdřív řádky, pak přidané kusy. */
export function draftToActions(draft: OrderEditDraft): EditAction[] {
  const actions: EditAction[] = []
  for (const [itemId, change] of Object.entries(draft.lines)) {
    if (change.type === "remove") {
      actions.push({ type: "remove", item_id: itemId })
    } else if (change.type === "swap") {
      actions.push({ type: "swap", item_id: itemId, variant_id: change.variant_id })
    } else {
      actions.push({
        type: "set_quantity",
        item_id: itemId,
        quantity: change.quantity,
      })
    }
  }
  for (const add of draft.adds) {
    actions.push({ type: "add", variant_id: add.variant_id, quantity: add.quantity })
  }
  return actions
}

/** Strop stepperu řádku: sklad ze serveru, ale nikdy pod to, co už je objednané
    (když mezitím ubyl sklad, jde počet jen snížit). */
export const lineQuantityCap = (item: EditableItem) =>
  Math.min(
    MAX_SET_QUANTITY,
    Math.max(1, item.quantity, Math.floor(Number(item.max_quantity) || 0))
  )

/** Varianta, na kterou jde řádek vyměnit v daném režimu. */
export const canSwapTo = (
  item: EditableItem,
  variantId: string,
  mode: OrderEditContext["mode"]
) => {
  const variant = item.variants.find((v) => v.id === variantId)
  if (!variant || variant.id === item.variant_id || !variant.available) return false
  // Zabaleno: jen za stejnou cenu — Lucie přebalí, peníze se nehnou.
  if (mode === "swap_only") return variant.price_czk === item.unit_price
  return mode === "full"
}

/**
 * Srovná návrh s aktuálním kontextem — objednávku mezitím mohla Lucie zabalit,
 * kus se mohl vyprodat, řádek zmizet. Co už neplatí, tiše vypadne; server by
 * to stejně odmítl a zákazník by jen hádal proč.
 */
export function sanitizeDraft(
  draft: OrderEditDraft,
  context: OrderEditContext
): OrderEditDraft {
  const clean = emptyDraft()
  const itemsEditable =
    context.editable && context.items_editable && context.mode !== "none"
  if (!itemsEditable) return clean

  for (const [itemId, change] of Object.entries(draft.lines)) {
    const item = context.items.find((candidate) => candidate.id === itemId)
    if (!item || item.lock) continue

    if (change.type === "remove") {
      if (context.mode === "full") clean.lines[itemId] = change
    } else if (change.type === "set_quantity") {
      if (context.mode !== "full") continue
      const quantity = clampInt(change.quantity, 1, lineQuantityCap(item))
      if (quantity !== item.quantity) {
        clean.lines[itemId] = { type: "set_quantity", quantity }
      }
    } else if (change.product) {
      /* Výměna za jiný výrobek: varianta v `item.variants` není, takže tu jde
         ověřit jen řádek a režim. Nabídku (sklad, cena po zabalení, dobírka)
         zúžil server v katalogu a při náhledu i uložení soudí znovu. */
      if (
        (context.mode === "full" || context.mode === "swap_only") &&
        change.variant_id !== item.variant_id
      ) {
        clean.lines[itemId] = change
      }
    } else if (canSwapTo(item, change.variant_id, context.mode)) {
      clean.lines[itemId] = change
    }
  }

  if (context.can_add) {
    for (const add of draft.adds) {
      if (draftActionCount(clean) >= MAX_EDIT_ACTIONS) break
      clean.adds.push(add)
    }
  }

  return clean
}

/**
 * Přidá kus do návrhu (z mini obchodu). Stejná varianta podruhé = víc kusů
 * v jednom řádku návrhu, ne dva řádky. Hlídá strop akcí z kontraktu, ať
 * zákazník nenaklikal něco, co server celé odmítne.
 */
export function addToDraft(
  orderId: string,
  add: DraftAdd
): { ok: true } | { ok: false; message: string } {
  const draft = readDraft(orderId)
  const existing = draft.adds.find((entry) => entry.variant_id === add.variant_id)

  if (existing) {
    const max = Math.max(existing.max_quantity, add.max_quantity)
    existing.max_quantity = max
    existing.quantity = clampInt(existing.quantity + add.quantity, 1, max)
  } else {
    if (draftActionCount(draft) >= MAX_EDIT_ACTIONS) {
      return { ok: false, message: TOO_MANY_CHANGES }
    }
    draft.adds.push({
      ...add,
      quantity: clampInt(add.quantity, 1, add.max_quantity),
    })
  }

  if (!writeDraft(orderId, draft)) return { ok: false, message: STORAGE_BLOCKED }
  return { ok: true }
}

/**
 * Zapíše změnu řádku (z mini obchodu: výměna za jiný výrobek). Nahradí
 * jakoukoli jinou rozpracovanou změnu téhož řádku — kontrakt dovoluje jednu
 * akci na řádek, stejně jako výměna varianty v sheetu na stránce úpravy.
 */
export function setDraftLine(
  orderId: string,
  itemId: string,
  change: DraftLineChange
): { ok: true } | { ok: false; message: string } {
  const draft = readDraft(orderId)
  if (!draft.lines[itemId] && draftActionCount(draft) >= MAX_EDIT_ACTIONS) {
    return { ok: false, message: TOO_MANY_CHANGES }
  }
  draft.lines[itemId] = change
  if (!writeDraft(orderId, draft)) return { ok: false, message: STORAGE_BLOCKED }
  return { ok: true }
}
