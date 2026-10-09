/**
 * Vznik a dohledání záznamu sledování (docs/sledovani-zasilek.md §4).
 *
 * Záznam vzniká automaticky po štítku (label route) a ručně z widgetu
 * („Začít sledovat"). Obě cesty jdou přes `ensureParcelTracking`, aby nikdy
 * nevznikly dva řádky na jednu objednávku a aby nové podací číslo (štítek
 * vygenerovaný znovu) sledování resetovalo — stará historie patří k číslu,
 * které už nikam nejede.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { PARCEL_TRACKING_MODULE } from "../../modules/parcel-tracking"
import type ParcelTrackingModuleService from "../../modules/parcel-tracking/service"
import { CP_CARRIER } from "./carrier"

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null

/**
 * Podací číslo objednávky: razítko z label route má přednost, pak data
 * fulfillmentu od providera, nakonec štítek fulfillmentu. Osobní odběr ani
 * záznam „jen ručně" číslo nemají → null → nesleduje se.
 */
export const parcelCodeOf = (order: any): string | null => {
  const fromMeta = str(order?.metadata?.cp_label_tracking)
  if (fromMeta) return fromMeta
  for (const fulfillment of (order?.fulfillments ?? []) as any[]) {
    if (fulfillment?.canceled_at) continue
    const fromData = str(fulfillment?.data?.parcel_code)
    if (fromData) return fromData
    for (const label of (fulfillment?.labels ?? []) as any[]) {
      const fromLabel = str(label?.tracking_number)
      if (fromLabel) return fromLabel
    }
  }
  return null
}

/** `NB` / `DR` — z fulfillmentu (provider ho tam zapisuje), jinak z dopravní metody. */
export const serviceCodeOf = (order: any): string | null => {
  for (const fulfillment of (order?.fulfillments ?? []) as any[]) {
    if (fulfillment?.canceled_at) continue
    const code = str(fulfillment?.data?.service_code)
    if (code) return code.toUpperCase()
  }
  for (const method of (order?.shipping_methods ?? []) as any[]) {
    const code = str(method?.data?.service_code)
    if (code && code.toUpperCase() !== "PICKUP") return code.toUpperCase()
  }
  return null
}

export const findParcelTracking = async (
  container: MedusaContainer,
  orderId: string
): Promise<any | null> => {
  const service = container.resolve<ParcelTrackingModuleService>(
    PARCEL_TRACKING_MODULE
  )
  const rows = (await service.listParcelTrackings(
    { order_id: orderId } as never,
    { take: 1 } as never
  )) as any[]
  return rows[0] ?? null
}

/**
 * Vrátí sledování na začátek (jen testovací prostředí — akce `reset` v routě):
 * fáze „štítek", bez událostí a razítek, ať jde simulaci zopakovat od předání.
 * Číslo zásilky, dopravce i poznámka zůstávají.
 */
export const resetParcelTracking = async (
  container: MedusaContainer,
  trackingId: string
): Promise<any> => {
  const service = container.resolve<ParcelTrackingModuleService>(
    PARCEL_TRACKING_MODULE
  )
  return service.updateParcelTrackings({
    id: trackingId,
    phase: "label",
    events: [],
    handed_over_at: null,
    stored_at: null,
    delivered_at: null,
    returned_at: null,
    last_state_id: null,
    last_state_text: null,
    last_checked_at: null,
    check_count: 0,
    done: false,
  } as never)
}

export type EnsureParcelTrackingInput = {
  order_id: string
  parcel_code: string
  service_code?: string | null
  /** Např. „test label" — zůstává, dokud číslo zásilky nezmění. */
  note?: string | null
}

/**
 * Upsert: existující řádek se stejným číslem jen doplní (service_code, note);
 * jiné číslo = nová zásilka → historie i razítka od nuly, `done` zpět na false.
 */
export const ensureParcelTracking = async (
  container: MedusaContainer,
  input: EnsureParcelTrackingInput
): Promise<any> => {
  const service = container.resolve<ParcelTrackingModuleService>(
    PARCEL_TRACKING_MODULE
  )
  const parcelCode = input.parcel_code.trim()
  const existing = await findParcelTracking(container, input.order_id)

  if (!existing) {
    return service.createParcelTrackings({
      order_id: input.order_id,
      carrier: CP_CARRIER,
      parcel_code: parcelCode,
      service_code: input.service_code ?? null,
      phase: "label",
      events: [],
      check_count: 0,
      done: false,
      note: input.note ?? null,
    } as never)
  }

  if (existing.parcel_code === parcelCode) {
    const patch: Record<string, unknown> = {}
    if (input.service_code && existing.service_code !== input.service_code) {
      patch.service_code = input.service_code
    }
    if (input.note !== undefined && input.note !== existing.note) {
      patch.note = input.note
    }
    if (!Object.keys(patch).length) {
      return existing
    }
    return service.updateParcelTrackings({ id: existing.id, ...patch } as never)
  }

  return service.updateParcelTrackings({
    id: existing.id,
    parcel_code: parcelCode,
    service_code: input.service_code ?? existing.service_code ?? null,
    phase: "label",
    events: [],
    handed_over_at: null,
    stored_at: null,
    delivered_at: null,
    returned_at: null,
    last_state_id: null,
    last_state_text: null,
    last_checked_at: null,
    check_count: 0,
    done: false,
    note: input.note ?? null,
  } as never)
}
