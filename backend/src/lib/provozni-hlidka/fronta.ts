import type { MedusaContainer } from "@medusajs/framework/types"
import { ACTIVITY_LOG_MODULE } from "../../modules/activity-log"
import type ActivityLogModuleService from "../../modules/activity-log/service"

/**
 * Fronta vývojářských e-mailů (4. 11. 2026).
 *
 * ## Proč
 *
 * Každá chyba šla e-mailem hned a zvlášť. 3. 11. jich odešlo 42 a vyčerpaly
 * denní limit Resendu (100 e-mailů), který sdílí i potvrzení objednávek
 * zákazníkům. Matěj chce místo toho **jeden e-mail za 4 hodiny** se vším, co
 * se za tu dobu pokazilo — a když se nepokazilo nic, žádný.
 *
 * ## Jak
 *
 * `notifyMerchant` u `audience: "dev"` e-mail neposílá, jen sem zapíše
 * řádek (zvonek v administraci vzniká dál hned). Úloha `send-provozni-alarmy`
 * každé 4 hodiny frontu přečte, sloučí opakování téže věci a pošle jeden
 * souhrn; ve 21:00 tu roli přebírá večerní provozní souhrn, aby nešly dva
 * e-maily naráz.
 *
 * Okno se nepočítá z hodin, ale **od konce minulého souhrnu** (značka
 * `alarm:souhrn-odeslan` nese `detail.do`). Když úloha jednou nepoběží
 * (restart, nasazení), další souhrn pokryje i zmeškanou dobu — nic se
 * neztratí.
 */

export const AKCE_VE_FRONTE = "alarm:ve-fronte"
export const AKCE_SOUHRN_ODESLAN = "alarm:souhrn-odeslan"

/**
 * Druh, pod kterým si fronta účtuje sama sebe.
 *
 * Tyhle řádky NEJSOU provozní chyba — ke každé chybě vzniká ještě jeden,
 * který říká „čeká na odeslání". V deníku a na stránce Provoz se proto
 * přeskakují: jinak by se každá chyba počítala dvakrát a večerní souhrn by
 * vedle skutečného pádu vypsal ještě řádek „alarm · alarm:ve-fronte".
 */
export const DRUH_FRONTY = "alarm"

/** Je to účetní řádek fronty, ne něco, co se v obchodě pokazilo? */
export const jeRadekFronty = (zaznam: { kind?: string | null }): boolean =>
  zaznam.kind === DRUH_FRONTY

const HODINA = 60 * 60 * 1000
/** Bez předchozího souhrnu (první běh) se bere poslední čtyři hodiny. */
const VYCHOZI_OKNO = 4 * HODINA
/** Nejdál zpátky, kam se souhrn dívá — deník se po 30 dnech maže. */
const NEJDAL_ZPET = 7 * 24 * HODINA
/** Tolik různých věcí se vypíše celých, zbytek už jen názvem. */
const CELYCH_NEJVYS = 25
/** Jeden popis (často se stopou výjimky) nesmí e-mail nafouknout. */
const POPIS_NEJVYS = 2500

export type PolozkaFronty = {
  klic: string
  titulek: string
  popis: string | null
  kdy: Date
}

export type SkupinaFronty = {
  klic: string
  titulek: string
  /** Nejnovější popis — u opakované chyby bývá nejpřesnější. */
  popis: string | null
  pocet: number
  prvni: Date
  posledni: Date
}

const sluzbaDeniku = (container: MedusaContainer) =>
  container.resolve(ACTIVITY_LOG_MODULE) as ActivityLogModuleService

/**
 * Zařadí e-mail do fronty. Vrací `false`, když se zápis nepovedl — volající
 * pak e-mail pošle hned, protože ztracená chyba je horší než e-mail navíc.
 */
export const zaradDoFronty = async (
  container: MedusaContainer,
  polozka: {
    klic: string
    titulek: string
    popis?: string | null
    resource?: { id: string; type: string } | null
  }
): Promise<boolean> => {
  try {
    await sluzbaDeniku(container).createActivityEvents({
      kind: "alarm",
      action: AKCE_VE_FRONTE,
      status: "chyba",
      actor: "systém",
      ref_type: polozka.resource?.type ?? null,
      ref_id: polozka.resource?.id ?? null,
      summary: polozka.titulek,
      detail: {
        klic: polozka.klic,
        titulek: polozka.titulek,
        popis: polozka.popis ?? null,
      },
      duration_ms: null,
    })
    return true
  } catch {
    return false
  }
}

/** Co čeká na odeslání: od konce minulého souhrnu do `doKdy`. */
export const nevyrizene = async (
  container: MedusaContainer,
  doKdy: Date
): Promise<{ od: Date; polozky: PolozkaFronty[] }> => {
  const service = sluzbaDeniku(container)

  const [posledni] = await service.listActivityEvents(
    { action: AKCE_SOUHRN_ODESLAN } as never,
    { take: 1, order: { created_at: "DESC" } }
  )

  const zeZnacky = posledni
    ? new Date(
        String(
          ((posledni.detail ?? {}) as Record<string, unknown>).do ??
            posledni.created_at
        )
      )
    : null

  const nejdal = new Date(doKdy.getTime() - NEJDAL_ZPET)
  let od =
    zeZnacky && !Number.isNaN(zeZnacky.getTime())
      ? zeZnacky
      : new Date(doKdy.getTime() - VYCHOZI_OKNO)
  if (od < nejdal) od = nejdal

  const radky = await service.listActivityEvents(
    { action: AKCE_VE_FRONTE, created_at: { $gt: od, $lte: doKdy } } as never,
    { take: 2000, order: { created_at: "ASC" } }
  )

  return {
    od,
    polozky: radky.map((radek) => {
      const detail = (radek.detail ?? {}) as Record<string, unknown>
      return {
        klic: String(detail.klic ?? radek.summary ?? radek.id),
        titulek: String(detail.titulek ?? radek.summary ?? "Bez názvu"),
        popis: typeof detail.popis === "string" ? detail.popis : null,
        kdy: new Date(radek.created_at as unknown as string),
      }
    }),
  }
}

/** Zapíše, že souhrn za okno odešel — od `doKdy` začíná další okno. */
export const oznacOdeslano = async (
  container: MedusaContainer,
  okno: { od: Date; doKdy: Date; pocet: number; hlaseni: number }
): Promise<void> => {
  await sluzbaDeniku(container).createActivityEvents({
    kind: "alarm",
    action: AKCE_SOUHRN_ODESLAN,
    status: "ok",
    actor: "systém",
    ref_type: null,
    ref_id: null,
    summary: `souhrn chyb: ${okno.pocet} věcí, ${okno.hlaseni} hlášení`,
    detail: {
      od: okno.od.toISOString(),
      do: okno.doKdy.toISOString(),
      pocet: okno.pocet,
      hlaseni: okno.hlaseni,
    },
    duration_ms: null,
  })
}

/** Sloučí opakování téže věci (stejný klíč) — v pořadí, jak poprvé nastaly. */
export const seskup = (polozky: PolozkaFronty[]): SkupinaFronty[] => {
  const skupiny = new Map<string, SkupinaFronty>()

  for (const polozka of polozky) {
    const skupina = skupiny.get(polozka.klic)
    if (!skupina) {
      skupiny.set(polozka.klic, {
        klic: polozka.klic,
        titulek: polozka.titulek,
        popis: polozka.popis,
        pocet: 1,
        prvni: polozka.kdy,
        posledni: polozka.kdy,
      })
      continue
    }
    skupina.pocet += 1
    if (polozka.kdy < skupina.prvni) skupina.prvni = polozka.kdy
    if (polozka.kdy >= skupina.posledni) {
      skupina.posledni = polozka.kdy
      if (polozka.popis) skupina.popis = polozka.popis
    }
  }

  return [...skupiny.values()].sort(
    (a, b) => a.prvni.getTime() - b.prvni.getTime()
  )
}

/** „1 věc" · „2 věci" · „5 věcí". */
export const pocetVeci = (pocet: number): string => {
  if (pocet === 1) return "1 věc"
  if (pocet >= 2 && pocet <= 4) return `${pocet} věci`
  return `${pocet} věcí`
}

const cas = (kdy: Date): string =>
  kdy.toLocaleTimeString("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
  })

const den = (kdy: Date): string =>
  kdy.toLocaleDateString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })

const casSDnem = (kdy: Date): string => `${den(kdy)} ${cas(kdy)}`

const okno = (od: Date, doKdy: Date): string =>
  den(od) === den(doKdy)
    ? `${den(doKdy)} ${cas(od)}–${cas(doKdy)}`
    : `${casSDnem(od)} – ${casSDnem(doKdy)}`

export const predmetFronty = (
  skupiny: SkupinaFronty[],
  od: Date,
  doKdy: Date
): string =>
  `Provoz: ${pocetVeci(skupiny.length)} k řešení (${okno(od, doKdy)})`

const odsad = (text: string): string =>
  text
    .split("\n")
    .map((radek) => (radek.length ? `   ${radek}` : radek))
    .join("\n")

/**
 * Tělo souhrnu chyb. Čisté skládání (bez containeru), aby se dalo ověřit
 * testem — na obsahu toho e-mailu záleží nejvíc.
 */
export const textFronty = (
  skupiny: SkupinaFronty[],
  od: Date,
  doKdy: Date
): string => {
  const hlaseni = skupiny.reduce((soucet, s) => soucet + s.pocet, 0)
  const radky: string[] = [
    `V době ${okno(od, doKdy)} se pokazilo: ${pocetVeci(skupiny.length)}` +
      (hlaseni > skupiny.length ? ` (celkem ${hlaseni} hlášení).` : "."),
    "Každá věc je tu jednou; „×3“ znamená, že se za tu dobu opakovala.",
  ]

  skupiny.slice(0, CELYCH_NEJVYS).forEach((skupina, index) => {
    radky.push(
      "",
      `${index + 1}. ${skupina.titulek}${skupina.pocet > 1 ? `  ×${skupina.pocet}` : ""}`,
      skupina.pocet > 1
        ? `   poprvé ${cas(skupina.prvni)}, naposledy ${cas(skupina.posledni)}`
        : `   ${cas(skupina.prvni)}`
    )
    if (skupina.popis) {
      const popis =
        skupina.popis.length > POPIS_NEJVYS
          ? `${skupina.popis.slice(0, POPIS_NEJVYS)}\n…(zkráceno)`
          : skupina.popis
      radky.push("", odsad(popis))
    }
  })

  const zbytek = skupiny.slice(CELYCH_NEJVYS)
  if (zbytek.length) {
    radky.push("", `A dalších ${pocetVeci(zbytek.length)} (podrobnosti v Přehled → Provoz):`)
    for (const skupina of zbytek) {
      radky.push(`· ${skupina.titulek}${skupina.pocet > 1 ? ` ×${skupina.pocet}` : ""}`)
    }
  }

  radky.push(
    "",
    "Vývojářské e-maily chodí nejvýš jednou za 4 hodiny a jen tehdy, když " +
      "se něco pokazilo — aby nezabraly denní limit e-mailů pro zákazníky. " +
      "Okamžitě je všechno vidět ve zvonečku a v Přehled → Provoz.",
    "Tenhle e-mail můžete celý vložit do chatu s Claudem — jsou v něm " +
      "všechna čísla, podle kterých se to dá dohledat."
  )

  return radky.join("\n")
}
