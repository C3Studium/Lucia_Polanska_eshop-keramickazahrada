import type { MedusaContainer } from "@medusajs/framework/types"
import { createHash } from "node:crypto"
import { notifyMerchant } from "../notify"
import { ciziSluzba, nazevSeSluzbou, type CiziSluzba } from "./sluzba"
import { pocetDnes, ulozZaznam } from "./uloz"
import { denPrahy } from "./zprava"

/**
 * Alarmy (3. 11. 2026, přepsáno podle připomínky „když se něco pokazí, musí
 * to poslat").
 *
 * ## Co se změnilo a proč
 *
 * První verze měla v klíči jen kontrolu a den: `hlidka-faktury:2026-11-03`.
 * Na opakování téhož to bylo správně, ale **nová chyba se tím spolkla** —
 * když v devět selhala faktura u #68 a ve dvě u #71, druhý e-mail nepřišel,
 * protože klíč byl stejný. A právě ten druhý byl ten, o kterém se nevědělo.
 *
 * Klíč proto nese **podpis konkrétní chyby**: která objednávka, která akce,
 * jaký text výjimky. Nová chyba je nový klíč a jde hned. Opakování téže
 * chyby je pořád jeden e-mail za den, protože dvacáté hlášení o jedné
 * rozbité věci není informace.
 *
 * ## Strop a proč tam je
 *
 * Účet Resend dává **sto e-mailů denně** a sdílí je s objednávkami zákazníků.
 * Když se něco rozbije hromadně (spadlá brána, padesát objednávek za hodinu),
 * mohl by deník vyčerpat limit a zákazník by nedostal ani potvrzení.
 *
 * Strop je proto čtyřicet alarmů denně. Při jeho dosažení odejde JEDEN e-mail
 * o tom, že se strop vyčerpal, a dál se chyby zapisují už jen do deníku —
 * odkud je přečte večerní souhrn a stránka Provoz. Padesátá chyba za hodinu
 * navíc neříká nic, co by neřekla desátá.
 */

/** Víc alarmů denně než tohle je příznak hromadné poruchy, ne informace. */
const STROP_ALARMU = 40

/** Akce, pod kterou se v deníku počítají odeslané alarmy. */
export const AKCE_ALARMU = "alarm:odeslan"

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

const DO_CHATU =
  "Tenhle e-mail můžete celý vložit do chatu s Claudem — jsou v něm " +
  "všechna čísla, podle kterých se to dá dohledat."

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

  radky.push(
    "",
    "Každá nová chyba přijde zvlášť a hned. Tatáž chyba se po zbytek dne " +
      "už jen zapisuje do Provozu, aby nezabrala denní limit e-mailů.",
    DO_CHATU
  )

  return radky.join("\n")
}

/**
 * Pošle alarm k jedné konkrétní chybě. Nikdy nevyhodí výjimku — alarm je
 * následek chyby a nesmí se stát druhou chybou.
 *
 * Vrací, co se stalo, hlavně kvůli testům a logu: `poslano`, `strop`
 * (vyčerpaný denní strop) nebo `bez-prijemce`.
 */
export const posliAlarm = async (
  container: MedusaContainer,
  podnet: PodnetAlarmu,
  kdy: Date = new Date()
): Promise<"poslano" | "strop" | "chyba"> => {
  try {
    const sluzba =
      podnet.sluzba ??
      ciziSluzba(podnet.klic, podnet.nazev, podnet.zprava, ...(podnet.detail ?? []))

    const podpis = podpisChyby(
      podnet.klic,
      ...(podnet.podpis ?? [podnet.zprava]),
      podnet.cehoSeTyka?.id
    )

    const odeslano = await pocetDnes(container, AKCE_ALARMU)

    if (odeslano >= STROP_ALARMU) {
      /* Jeden e-mail o vyčerpaném stropu za den — klíč ho drží i přes
         restart služby. Dál se chyby zapisují už jen do deníku. */
      await notifyMerchant(container, {
        key: `mn:hlidkastrop:${denPrahy(kdy)}`,
        title: "Provoz: chyb je dnes tolik, že se přestaly posílat",
        description: [
          `Dnes odešlo ${odeslano} alarmů, což je denní strop.`,
          "",
          "Další chyby se zapisují do Přehled → Provoz, ale e-mailem už " +
            "nechodí — jinak by zabraly denní limit a zákazníkům by přestala " +
            "chodit i potvrzení objednávek.",
          "",
          "Tolik chyb za den znamená hromadnou poruchu. Podívejte se do " +
            "Provozu, co se opakuje.",
        ].join("\n"),
        audience: "dev",
        urgent: true,
      })

      await ulozZaznam(container, {
        kind: "alarm",
        action: "alarm:strop",
        status: "chyba",
        actor: "systém",
        summary: `strop ${STROP_ALARMU} alarmů za den vyčerpán`,
        detail: { klic: podnet.klic, zprava: podnet.zprava },
      })

      return "strop"
    }

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

    await ulozZaznam(container, {
      kind: "alarm",
      action: AKCE_ALARMU,
      status: "ok",
      actor: "systém",
      summary: `${podnet.nazev}${sluzba ? ` — ${sluzba}` : ""}`,
      detail: { klic: podnet.klic, podpis, zprava: podnet.zprava },
      ref_type: podnet.cehoSeTyka?.typ ?? null,
      ref_id: podnet.cehoSeTyka?.id ?? null,
    })

    return "poslano"
  } catch {
    /* Alarm je následek chyby; druhá chyba z něj nesmí nic shodit. Zápis
       o selhání se ani nezkouší — kdyby nešel deník, nešel by ani ten. */
    return "chyba"
  }
}
