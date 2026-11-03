import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ACTIVITY_LOG_MODULE } from "../../modules/activity-log"
import type ActivityLogModuleService from "../../modules/activity-log/service"

/**
 * Zápis do provozního deníku (3. 11. 2026).
 *
 * ## Jedno pravidlo, od kterého se tu nikdy neustupuje
 *
 * **Zápis nesmí shodit to, co zapisuje.** Deník je pozorovatel; kdyby
 * objednávka padla proto, že se nepovedlo zapsat, že vznikla, byla by
 * škoda z pozorování větší než užitek. Proto má každá cesta sem `catch`,
 * který skončí logem, a volající nikdy neuvidí výjimku.
 *
 * Z toho plyne i druhá věc: na zápis se nikdy nečeká kvůli odpovědi
 * uživateli. Middleware zapisuje po odeslání odpovědi, subscribery mimo
 * kritickou cestu platby.
 */

/** Hrubé škatulky do souhrnu. Nový druh se smí přidat bez migrace. */
export type DruhProvozu =
  | "platba"
  | "faktura"
  | "email"
  | "objednavka"
  | "zakazka"
  | "reklamace"
  | "poukaz"
  | "kurz"
  | "prihlaseni"
  | "admin"
  | "obchod"
  | "uloha"
  | "web"

export type ZapisProvozu = {
  druh: DruhProvozu
  /** Stabilní tvar, ať se dá počítat „kolikrát dnes": `payment.captured`. */
  akce: string
  stav: "ok" | "chyba"
  /** `admin:<id>`, `zákazník`, `systém`. Nikdy jméno ani e-mail. */
  kdo?: string | null
  cehoSeTyka?: { typ: string; id: string } | null
  /** Jedna věta česky. */
  popis?: string | null
  /** Přesné podrobnosti k dohledání — čísla, stavy, text výjimky. */
  detail?: Record<string, unknown> | null
  trvaloMs?: number | null
}

/**
 * Zapíše řádek do deníku. Nikdy nevyhodí výjimku — selhání zápisu skončí
 * varováním v logu, protože i „deník nefunguje" je informace, kterou má
 * smysl mít, a shozená objednávka ne.
 */
export const zapisProvoz = async (
  container: MedusaContainer,
  zapis: ZapisProvozu
): Promise<void> => {
  try {
    const service = container.resolve(
      ACTIVITY_LOG_MODULE
    ) as ActivityLogModuleService

    await service.createActivityEvents({
      kind: zapis.druh,
      action: zapis.akce,
      status: zapis.stav,
      actor: zapis.kdo ?? null,
      ref_type: zapis.cehoSeTyka?.typ ?? null,
      ref_id: zapis.cehoSeTyka?.id ?? null,
      summary: zapis.popis ?? null,
      detail: zapis.detail ?? null,
      duration_ms:
        typeof zapis.trvaloMs === "number" ? Math.round(zapis.trvaloMs) : null,
    })
  } catch (error) {
    try {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `[provoz] zápis „${zapis.druh}/${zapis.akce}" se nepovedl: ` +
            String((error as Error)?.message ?? error)
        )
    } catch {
      /* Ani logger nemusí být po ruce (test, rozpadlý container). */
    }
  }
}

/**
 * Zabalí kus práce: zapíše, že proběhla, nebo že selhala — a výjimku
 * pustí dál. Selhání se tedy objeví v deníku A ZÁROVEŇ se chová, jak se
 * od něj čeká; deník nic nezhojí ani nespolkne.
 */
export const sZapisem = async <T>(
  container: MedusaContainer,
  zapis: Omit<ZapisProvozu, "stav" | "trvaloMs">,
  prace: () => Promise<T>
): Promise<T> => {
  const start = Date.now()
  try {
    const vysledek = await prace()
    await zapisProvoz(container, {
      ...zapis,
      stav: "ok",
      trvaloMs: Date.now() - start,
    })
    return vysledek
  } catch (error) {
    await zapisProvoz(container, {
      ...zapis,
      stav: "chyba",
      trvaloMs: Date.now() - start,
      detail: {
        ...(zapis.detail ?? {}),
        chyba: String((error as Error)?.message ?? error),
        /* Stopa jen zkrácená — v e-mailu stačí první rámce k poznání místa. */
        stopa: String((error as Error)?.stack ?? "")
          .split("\n")
          .slice(0, 6)
          .join("\n"),
      },
    })
    throw error
  }
}
