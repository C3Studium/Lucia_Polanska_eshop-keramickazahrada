import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ACTIVITY_LOG_MODULE } from "../../modules/activity-log"
import type ActivityLogModuleService from "../../modules/activity-log/service"

/**
 * Nejnižší vrstva deníku: uloží řádek a nikdy nevyhodí výjimku.
 *
 * ## Proč samostatný soubor
 *
 * Zápis do deníku (`zapis.ts`) musí při selhání poslat alarm, a alarm
 * (`alarm.ts`) si musí zapsat, že odešel — kdyby na sebe volaly přímo,
 * vznikl by kruh v importech. Obě tedy sahají sem.
 *
 * ## Pravidlo
 *
 * **Zápis nesmí shodit to, co zapisuje.** Deník je pozorovatel; kdyby
 * objednávka padla proto, že se nepovedlo zapsat, že vznikla, byla by škoda
 * z pozorování větší než užitek.
 */

export type RadekDeniku = {
  kind: string
  action: string
  status: "ok" | "chyba"
  actor?: string | null
  ref_type?: string | null
  ref_id?: string | null
  summary?: string | null
  detail?: Record<string, unknown> | null
  duration_ms?: number | null
}

export const ulozZaznam = async (
  container: MedusaContainer,
  radek: RadekDeniku
): Promise<void> => {
  try {
    const service = container.resolve(
      ACTIVITY_LOG_MODULE
    ) as ActivityLogModuleService

    await service.createActivityEvents({
      kind: radek.kind,
      action: radek.action,
      status: radek.status,
      actor: radek.actor ?? null,
      ref_type: radek.ref_type ?? null,
      ref_id: radek.ref_id ?? null,
      summary: radek.summary ?? null,
      detail: radek.detail ?? null,
      duration_ms:
        typeof radek.duration_ms === "number"
          ? Math.round(radek.duration_ms)
          : null,
    })
  } catch (error) {
    try {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `[provoz] zápis „${radek.kind}/${radek.action}" se nepovedl: ` +
            String((error as Error)?.message ?? error)
        )
    } catch {
      /* Ani logger nemusí být po ruce (test, rozpadlý container). */
    }
  }
}

/** Kolik řádků dané akce dnes (od pražské půlnoci) v deníku je. */
export const pocetDnes = async (
  container: MedusaContainer,
  akce: string
): Promise<number> => {
  const service = container.resolve(
    ACTIVITY_LOG_MODULE
  ) as ActivityLogModuleService

  /* Pražská půlnoc, ne UTC: strop alarmů má odpovídat dni, jak ho vidí
     člověk, který ty e-maily ráno čte. */
  const ted = new Date()
  const pragueDen = ted.toLocaleDateString("sv-SE", {
    timeZone: "Europe/Prague",
  })
  const posun = ted.toLocaleString("en-US", {
    timeZone: "Europe/Prague",
    timeZoneName: "longOffset",
  })
  const shoda = posun.match(/GMT([+-]\d{2}:\d{2})/)
  const od = new Date(`${pragueDen}T00:00:00${shoda ? shoda[1] : "Z"}`)

  const [, pocet] = await service.listAndCountActivityEvents(
    { action: akce, created_at: { $gte: od } } as never,
    { take: 1 }
  )

  return pocet
}
