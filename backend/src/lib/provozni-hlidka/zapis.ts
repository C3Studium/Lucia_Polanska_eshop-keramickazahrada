import type { MedusaContainer } from "@medusajs/framework/types"
import { posliAlarm } from "./alarm"
import { ulozZaznam } from "./uloz"

/**
 * Zápis do provozního deníku (3. 11. 2026).
 *
 * ## Co se stane při selhání
 *
 * Každý řádek se stavem `chyba` **sám spustí alarm**. Je to schválně tady a
 * ne u volajících: kdyby alarm posílalo každé místo samo, nová funkce by ho
 * neměla a o její chybě by se nikdo nedozvěděl. Takhle stačí, že akce
 * proteče deníkem — a tím protéká všechno.
 *
 * Alarm se odesílá bez čekání (`void`): zápis i alarm jsou pozorovatelé a
 * nesmí zdržet to, co pozorují. Dedupe, strop a rozpoznání cizí služby řeší
 * `alarm.ts`.
 *
 * ## Pravidlo, od kterého se neustupuje
 *
 * **Zápis nesmí shodit to, co zapisuje** (viz `uloz.ts`). Platí to i pro
 * alarm: `posliAlarm` nikdy nevyhazuje.
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
  | "alarm"

export type ZapisProvozu = {
  druh: DruhProvozu
  /** Stabilní tvar, ať se dá počítat „kolikrát dnes": `payment.captured`. */
  akce: string
  stav: "ok" | "chyba"
  /** `user:<id>`, `zákazník`, `systém`. Nikdy jméno ani e-mail. */
  kdo?: string | null
  cehoSeTyka?: { typ: string; id: string } | null
  /** Jedna věta česky. */
  popis?: string | null
  /** Přesné podrobnosti k dohledání — čísla, stavy, text výjimky. */
  detail?: Record<string, unknown> | null
  trvaloMs?: number | null
  /**
   * Nechat `true` tam, kde alarm posílá volající sám s lepším popisem
   * (obal úlohy, příjem chyb z webu, kontroly hlídky) — jinak by k jedné
   * chybě odešly dva e-maily.
   */
  bezAlarmu?: boolean
}

/** Česky pojmenované druhy pro předmět alarmu. */
const NAZVY: Record<DruhProvozu, string> = {
  platba: "Platba",
  faktura: "Faktura",
  email: "E-mail",
  objednavka: "Objednávka",
  zakazka: "Zakázka",
  reklamace: "Reklamace",
  poukaz: "Dárkový poukaz",
  kurz: "Kurz",
  prihlaseni: "Přihlášení",
  admin: "Změna v administraci",
  obchod: "Nákupní cesta",
  uloha: "Úloha na pozadí",
  web: "Web",
  alarm: "Alarm",
}

/**
 * Zapíše řádek do deníku a při selhání spustí alarm. Nikdy nevyhodí
 * výjimku.
 */
export const zapisProvoz = async (
  container: MedusaContainer,
  zapis: ZapisProvozu
): Promise<void> => {
  await ulozZaznam(container, {
    kind: zapis.druh,
    action: zapis.akce,
    status: zapis.stav,
    actor: zapis.kdo ?? null,
    ref_type: zapis.cehoSeTyka?.typ ?? null,
    ref_id: zapis.cehoSeTyka?.id ?? null,
    summary: zapis.popis ?? null,
    detail: zapis.detail ?? null,
    duration_ms: zapis.trvaloMs ?? null,
  })

  if (zapis.stav !== "chyba" || zapis.bezAlarmu) return

  const detail = zapis.detail ?? {}
  const duvod = String(detail.chyba ?? zapis.popis ?? "bez bližšího určení")

  void posliAlarm(container, {
    klic: `${zapis.druh}-${zapis.akce}`.replace(/[^a-z0-9-]/gi, "-"),
    nazev: `${NAZVY[zapis.druh]} · ${zapis.akce}`,
    zprava: duvod,
    detail: [
      `Akce: ${zapis.akce}`,
      ...(zapis.kdo ? [`Kdo: ${zapis.kdo}`] : []),
      ...Object.entries(detail).map(
        ([klic, hodnota]) =>
          `${klic}: ${
            typeof hodnota === "string" ? hodnota : JSON.stringify(hodnota)
          }`
      ),
    ],
    /* Podpis drží „jiná chyba = jiný řádek souhrnu": akce, důvod a čeho se to týká.
       Stav odpovědi je v důvodu, takže 422 a 500 na téže cestě jsou dvě
       různé chyby — a to je správně, jsou. */
    podpis: [zapis.akce, duvod],
    cehoSeTyka: zapis.cehoSeTyka ?? null,
  })
}

/**
 * Zabalí kus práce: zapíše, že proběhla, nebo že selhala — a výjimku pustí
 * dál. Selhání se tedy objeví v deníku, pošle alarm A ZÁROVEŇ se chová, jak
 * se od něj čeká; deník nic nezhojí ani nespolkne.
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
          .slice(1, 6)
          .map((radek) => radek.trim())
          .join("\n"),
      },
    })
    throw error
  }
}
