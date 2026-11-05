import type { MedusaContainer } from "@medusajs/framework/types"
import { createHash } from "node:crypto"
import { notifyMerchant } from "../notify"
import { ciziSluzba, nazevSeSluzbou, type CiziSluzba } from "./sluzba"
import { denPrahy } from "./zprava"

/**
 * Alarmy (3. 11. 2026; 4. 11. 2026 převedeno na souhrn po 4 hodinách).
 *
 * ## Podpis chyby
 *
 * Klíč nese **podpis konkrétní chyby**: která objednávka, která akce, jaký
 * text výjimky. Když v devět selže faktura u #68 a ve dvě u #71, jsou to dvě
 * různé věci a v souhrnu jsou obě. Opakování téže chyby se v souhrnu sloučí
 * do jednoho řádku s počtem („×16").
 *
 * ## Proč už ne e-mail hned
 *
 * 3. 11. odešlo 42 vývojářských e-mailů a vyčerpaly denní limit Resendu
 * (100), který sdílí i potvrzení objednávek. Alarm proto vytvoří hned jen
 * zvonek v administraci a zařadí se do fronty (`fronta.ts`); e-mailem
 * chodí jeden souhrn za 4 hodiny, a jen když se něco pokazilo. Denní strop
 * alarmů tím odpadl — víc než šest vývojářských e-mailů za den už nevznikne.
 */

/**
 * Podpis chyby — z něj je klíč. Normalizuje se, aby se *táž* chyba poznala
 * i přes rozdíly, které nic neznamenají: čísla se v textu výjimky zahazují
 * (časy, délky, pořadí), velká písmena se srovnávají.
 */
export const podpisChyby = (...casti: Array<string | null | undefined>): string => {
  const text = casti
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    /*
     * Zahazují se jen čísla o čtyřech a víc číslicích: tak dlouhá bývá
     * proměnlivá hodnota (trvání v ms, časové razítko, port), u které rozdíl
     * neznamená jinou chybu.
     *
     * Kratší čísla se NECHÁVAJÍ, a to schválně — stavový kód má tři číslice
     * a 500 od brány je jiná porucha než 401. Dřív se zahazovala všechna a
     * obě chyby se slily do jedné; na to přišel test, ne provoz.
     */
    .replace(/\d{4,}/g, "#")
    .replace(/\s+/g, " ")
    .trim()

  return createHash("sha1").update(text).digest("hex").slice(0, 10)
}

export type PodnetAlarmu = {
  /** Stabilní klíč okruhu: `faktury`, `uloha-watch-provoz`, `web-page`. */
  klic: string
  /** Česky, do předmětu: „Faktury v iDokladu", „Úloha watch-provoz". */
  nazev: string
  /** Co přesně je špatně — jedna věta. */
  zprava: string
  /** Řádky k dohledání: čísla objednávek, text výjimky, odpověď služby. */
  detail?: string[]
  /**
   * Co dělá tuhle chybu odlišnou od jiné ve stejném okruhu: id objednávky,
   * název akce, text výjimky. Bez toho by se dvě různé chyby slily do jedné.
   */
  podpis?: Array<string | null | undefined>
  /** Čeho se to týká — do deníku a do e-mailu. */
  cehoSeTyka?: { typ: string; id: string } | null
  /** Když je známá; jinak se hádá z ostatních vodítek. */
  sluzba?: CiziSluzba
}

const casPrahy = (kdy: Date): string =>
  kdy.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })


/** Text alarmu. Nikdy neodkazuje do logu — k logu se od telefonu nedostane. */
export const textAlarmuChyby = (
  podnet: PodnetAlarmu,
  sluzba: CiziSluzba,
  kdy: Date
): string => {
  const radky = [
    `Co selhalo: ${podnet.nazev}`,
    ...(sluzba ? [`Cizí služba: ${sluzba}`] : []),
    ...(podnet.cehoSeTyka
      ? [`Týká se: ${podnet.cehoSeTyka.typ} ${podnet.cehoSeTyka.id}`]
      : []),
    `Kdy: ${casPrahy(kdy)}`,
    "",
    "Co je špatně:",
    podnet.zprava,
  ]

  if (podnet.detail?.length) {
    radky.push("", "Podrobnosti:")
    for (const polozka of podnet.detail) {
      radky.push(`· ${polozka}`)
    }
  }

  return radky.join("\n")
}

/**
 * Zařadí alarm k jedné konkrétní chybě: zvonek hned, e-mail souhrnem.
 * Nikdy nevyhodí výjimku — alarm je následek chyby a nesmí se stát druhou
 * chybou.
 */
export const posliAlarm = async (
  container: MedusaContainer,
  podnet: PodnetAlarmu,
  kdy: Date = new Date()
): Promise<"zarazeno" | "chyba"> => {
  try {
    const sluzba =
      podnet.sluzba ??
      ciziSluzba(podnet.klic, podnet.nazev, podnet.zprava, ...(podnet.detail ?? []))

    const podpis = podpisChyby(
      podnet.klic,
      ...(podnet.podpis ?? [podnet.zprava]),
      podnet.cehoSeTyka?.id
    )

    await notifyMerchant(container, {
      key: `mn:hlidka${podnet.klic.replace(/[^a-z0-9]/gi, "")}-${podpis}:${denPrahy(kdy)}`,
      title: `Nefunguje: ${nazevSeSluzbou(podnet.nazev, sluzba)}`,
      description: textAlarmuChyby(podnet, sluzba, kdy),
      audience: "dev",
      urgent: true,
      ...(podnet.cehoSeTyka
        ? { resource: { id: podnet.cehoSeTyka.id, type: podnet.cehoSeTyka.typ } }
        : {}),
    })

    return "zarazeno"
  } catch {
    /* Alarm je následek chyby; druhá chyba z něj nesmí nic shodit. */
    return "chyba"
  }
}
