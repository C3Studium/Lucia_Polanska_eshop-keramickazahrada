import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { applyParcelEvents } from "../lib/parcel-tracking/apply"
import { fetchParcelEvents } from "../lib/parcel-tracking/source"
import { PARCEL_TRACKING_MODULE } from "../modules/parcel-tracking"
import type ParcelTrackingModuleService from "../modules/parcel-tracking/service"

/**
 * Sledování zásilek České pošty (docs/sledovani-zasilek.md §5).
 *
 * Každou půlhodinu se zeptá České pošty (nAPI s přístupy, jinak veřejný JSON —
 * `lib/parcel-tracking/source`) na neuzavřené zásilky a projde odpověď přes
 * `applyParcelEvents` — tutéž cestu jako simulace z widgetu.
 * Z první „Podaná zásilka" vznikne shipment, fáze „odesláno" a e-mail
 * „předáno dopravci"; z „Doručená" razítko, ze kterého za týden vyjde prosba
 * o recenzi. Zákazníkovi odsud nic jiného nechodí — komunikace končí
 * předáním (přání majitelky).
 *
 * Nejvýš 50 zásilek na běh, nejdřív ty, na které se nikdy neptalo, pak
 * nejstarší kontrola. Chyba sítě u jedné zásilky = log + razítko kontroly,
 * zbytek běhu jede dál; nikdy se z ní nestane „zásilka se neobjevila".
 */

const MAX_PER_RUN = 50

export default async function watchParcelTracking(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<ParcelTrackingModuleService>(
    PARCEL_TRACKING_MODULE
  )

  // Postgres řadí NULL u ASC až na konec, takže by se čerstvé řádky při plné
  // dávce nikdy nedostaly na řadu — proto dva dotazy: napřed nikdy nekontrolované.
  const fresh = (await service.listParcelTrackings(
    { done: false, last_checked_at: null } as never,
    { take: MAX_PER_RUN, order: { created_at: "ASC" } } as never
  )) as any[]

  const remaining = MAX_PER_RUN - fresh.length
  const stale =
    remaining > 0
      ? ((await service.listParcelTrackings(
          { done: false, last_checked_at: { $ne: null } } as never,
          { take: remaining, order: { last_checked_at: "ASC" } } as never
        )) as any[])
      : []

  const rows = [...fresh, ...stale]
  if (!rows.length) {
    return
  }

  let checked = 0
  let failed = 0
  let changed = 0
  let finished = 0

  for (const row of rows) {
    const code = String(row.parcel_code ?? "").trim()
    if (!code) {
      continue
    }

    let events
    try {
      events = await fetchParcelEvents(code)
    } catch (error) {
      failed++
      logger.warn(
        `[sledování] ${code}: ${(error as Error)?.message ?? String(error)} — zkusím příště.`
      )
      await service
        .updateParcelTrackings({ id: row.id, last_checked_at: new Date() } as never)
        .catch(() => undefined)
      continue
    }

    try {
      const result = await applyParcelEvents(container, row, events, "cp")
      checked++
      if (result.plan.newEvents.length) changed++
      if (result.tracking?.done) finished++
      if (result.actions.length) {
        logger.info(`[sledování] ${code}: ${result.actions.join(", ")}.`)
      }
    } catch (error) {
      failed++
      logger.error(
        `[sledování] ${code}: zápis selhal — ${(error as Error)?.message ?? String(error)}`
      )
    }
  }

  logger.info(
    `[sledování] Zkontrolováno ${checked} zásilek (změna u ${changed}, uzavřeno ${finished}, chyb ${failed}).`
  )
}

export const config = {
  name: "watch-parcel-tracking",
  // Každou půlhodinu — dohoda z kontraktu: 1 dotaz na zásilku za 30 minut.
  schedule: "*/30 * * * *",
}
