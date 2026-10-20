"use client"

import { useEffect, useState } from "react"
import {
  getPriceReferences,
  type PriceReference,
} from "@lib/data/price-history"

/**
 * Referenční cena § 12a pro jednu variantu — s dávkováním.
 *
 * Mřížka obchodu vykreslí desítky karet naráz; kdyby se každá ptala sama,
 * byla by to desítka server actions za sebou (Next je pouští jednu po druhé).
 * Proto se dotazy z jednoho vykreslení sesbírají (`BATCH_DELAY_MS`) a jdou
 * jedním voláním `getPriceReferences` na měnu. Výsledky se drží v paměti
 * stránky, takže přepnutí filtru ani „Načíst další" se znovu neptá na
 * varianty, které už zná.
 *
 * Ptá se jen na varianty, které storefront vidí ve slevě (`price_type ===
 * "sale"`); ostatní hook vůbec nevolají.
 */

export type PriceReferenceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; reference: PriceReference }
  /** Backend nedostupný nebo variantu nezná — ukazuje se záložní „Sleva". */
  | { status: "unavailable" }

const BATCH_DELAY_MS = 30
const MAX_BATCH = 50
const TTL_MS = 10 * 60 * 1000
const FAILURE_TTL_MS = 30 * 1000

type CacheEntry = { value: PriceReference | null; at: number }
type Listener = (value: PriceReference | null) => void

const cache = new Map<string, CacheEntry>()
const waiting = new Map<string, Listener[]>()
const queue = new Map<string, Set<string>>()
let timer: ReturnType<typeof setTimeout> | null = null

const keyOf = (currency: string, variantId: string) => `${currency}:${variantId}`

const fresh = (entry: CacheEntry | undefined) =>
  Boolean(
    entry &&
      Date.now() - entry.at < (entry.value ? TTL_MS : FAILURE_TTL_MS)
  )

const settle = (key: string, value: PriceReference | null) => {
  cache.set(key, { value, at: Date.now() })
  const listeners = waiting.get(key) ?? []
  waiting.delete(key)
  listeners.forEach((listener) => listener(value))
}

const flush = () => {
  timer = null
  const batch = Array.from(queue.entries())
  queue.clear()

  for (const [currency, idSet] of batch) {
    const ids = Array.from(idSet)
    for (let i = 0; i < ids.length; i += MAX_BATCH) {
      const chunk = ids.slice(i, i + MAX_BATCH)
      getPriceReferences(chunk, currency)
        .then((references) => {
          chunk.forEach((id) =>
            settle(keyOf(currency, id), references?.[id] ?? null)
          )
        })
        .catch(() => {
          chunk.forEach((id) => settle(keyOf(currency, id), null))
        })
    }
  }
}

const request = (currency: string, variantId: string, listener: Listener) => {
  const key = keyOf(currency, variantId)
  const listeners = waiting.get(key)
  if (listeners) {
    listeners.push(listener)
    return
  }
  waiting.set(key, [listener])
  const ids = queue.get(currency) ?? new Set<string>()
  ids.add(variantId)
  queue.set(currency, ids)
  if (!timer) timer = setTimeout(flush, BATCH_DELAY_MS)
}

const toState = (value: PriceReference | null): PriceReferenceState =>
  value && value.lowest_30d != null
    ? { status: "ready", reference: value }
    : { status: "unavailable" }

const cachedState = (
  variantId: string | undefined,
  currency: string
): PriceReferenceState => {
  if (!variantId) return { status: "idle" }
  const entry = cache.get(keyOf(currency, variantId))
  return fresh(entry) ? toState(entry!.value) : { status: "loading" }
}

export function usePriceReference(
  variantId: string | undefined,
  currencyCode: string | undefined
): PriceReferenceState {
  const currency = String(currencyCode || "czk").toLowerCase()
  const [state, setState] = useState<PriceReferenceState>(() =>
    cachedState(variantId, currency)
  )

  useEffect(() => {
    const initial = cachedState(variantId, currency)
    setState(initial)
    if (initial.status !== "loading" || !variantId) return

    let active = true
    request(currency, variantId, (value) => {
      if (active) setState(toState(value))
    })
    return () => {
      active = false
    }
  }, [variantId, currency])

  return state
}
