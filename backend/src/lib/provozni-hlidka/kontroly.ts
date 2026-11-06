import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  IDOKLAD_BALANCE_METADATA_KEYS,
  IDOKLAD_METADATA_KEYS,
} from "../../modules/idoklad/types"
import { ACTIVITY_LOG_MODULE } from "../../modules/activity-log"
import type ActivityLogModuleService from "../../modules/activity-log/service"
import { jeMenaObchodu, MENA_ZAKLADNI, vypisMen } from "../currencies"
import { isPersonalPickupOrder } from "../personal-pickup"
import type { Kontrola, NalezKontroly } from "./typy"

/**
 * Jednotlivé kontroly (3. 11. 2026).
 *
 * Každá se ptá na VÝSLEDEK, ne na dostupnost služby — důvody jsou v `typy.ts`.
 * Všechny jsou jen čtení: hlídka nikdy nic nespravuje sama, protože oprava
 * naslepo ve tři ráno je horší než ráno přečtený e-mail.
 *
 * Lhůty jsou schválně velkorysé. Zachycení platby, vystavení faktury i podání
 * zásilky jsou práce na pozadí a mají vlastní smiřovací běhy; kdyby hlídka
 * budila po pěti minutách, hlásila by hlavně frontu.
 */

const HODINA = 60 * 60 * 1000
const DEN = 24 * HODINA

/** Platba autorizovaná a nezachycená — podpis nenastavené notifikační URL. */
const LHUTA_ZACHYCENI = 2 * HODINA
/** Zaplaceno bez faktury: fakturace jede ze subscriberu, pár minut trvá. */
const LHUTA_FAKTURY = 30 * 60 * 1000
/** Zaplaceno a neodeslané: dva dny unesou i víkend. */
const LHUTA_ODESLANI = 2 * DEN
/** Denní limit účtu Resend — nad ním se e-maily zákazníkům tiše ztrácejí. */
const DENNI_LIMIT_EMAILU = 100

const text = (hodnota: unknown): string =>
  typeof hodnota === "string" ? hodnota : JSON.stringify(hodnota)

/** Čas v Praze bez roku — do podrobností, kde rok nic nepřidá. */
const kdy = (hodnota: unknown): string => {
  const datum = hodnota ? new Date(String(hodnota)) : null
  if (!datum || Number.isNaN(datum.getTime())) return "neznámo kdy"
  return datum.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const cislo = (objednavka: Record<string, unknown>): string =>
  objednavka.display_id ? `#${objednavka.display_id}` : String(objednavka.id)

/** BigNumber, string i number — částky chodí ve všech třech podobách. */
const naCislo = (hodnota: unknown): number => {
  if (typeof hodnota === "number") return hodnota
  if (typeof hodnota === "string") {
    const prevedeno = Number(hodnota)
    return Number.isFinite(prevedeno) ? prevedeno : 0
  }
  if (hodnota && typeof hodnota === "object") {
    const kandidat = hodnota as Record<string, unknown>
    return naCislo(kandidat.value ?? kandidat.numeric_ ?? kandidat.raw_ ?? 0)
  }
  return 0
}

/** Nejvýš deset řádků podrobností — e-mail se má dát přečíst na telefonu. */
const UKAZAT = 10

const podrobnosti = (radky: string[]): string[] =>
  radky.length > UKAZAT
    ? [...radky.slice(0, UKAZAT), `…a dalších ${radky.length - UKAZAT}`]
    : radky

const soucetZachyceneho = (objednavka: Record<string, unknown>): number =>
  ((objednavka.payment_collections ?? []) as Record<string, unknown>[]).reduce(
    (soucet, sbirka) => soucet + naCislo(sbirka.captured_amount),
    0
  )

/**
 * Leží zaplacená objednávka bez odeslání?
 *
 * Vlastní funkce, a ne podmínka schovaná ve filtru: právě tohle pravidlo bylo
 * 3. 11. 2026 špatně a zaplavilo souhrn osobními odběry. Takhle se dá zkusit
 * na datech, ne až na živém e-mailu.
 */
export const cekaNaOdeslani = (objednavka: Record<string, unknown>): boolean => {
  if (String(objednavka.status) === "canceled") return false
  // Nezaplacené řeší jiná kontrola (zachycení platby) — tady by to byl šum.
  if (soucetZachyceneho(objednavka) < 0.005) return false
  // Bez dopravy není co podat (elektronický poukaz, `requires_shipping: false`).
  const zpusoby = (objednavka.shipping_methods ?? []) as Record<string, unknown>[]
  if (!zpusoby.length) return false
  // Osobní odběr se neodesílá — zákazník si přijde a platí u pultu.
  if (isPersonalPickupOrder(objednavka as never)) return false
  return String(objednavka.fulfillment_status ?? "not_fulfilled") === "not_fulfilled"
}

/* ------------------------------------------------------------------ */

const databaze: Kontrola = {
  klic: "databaze",
  nazev: "Databáze a dotazy",
  spust: async (c) => {
    const query = (c as MedusaContainer).resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: ["id"],
      pagination: { take: 1 },
    })
    return {
      stav: "ok",
      zprava: data.length ? "odpovídá" : "odpovídá (zatím bez objednávek)",
    }
  },
}

/**
 * Nezdařené e-maily zákazníkům. `watch-failed-emails` o nich píše po jednom
 * hned; tady je po dni vidět souhrnně — a hlavně s důvodem, který v tom
 * okamžitém e-mailu chybí.
 */
const emailyZakaznikum: Kontrola = {
  klic: "emaily",
  nazev: "E-maily zákazníkům",
  spust: async (c) => {
    const notifications = (c as MedusaContainer).resolve(Modules.NOTIFICATION)
    const od = new Date(Date.now() - DEN)

    const nezdarene = (await notifications.listNotifications(
      { channel: "email", status: "failure", created_at: { $gte: od } } as never,
      { take: 50, order: { created_at: "DESC" } }
    )) as unknown as Record<string, unknown>[]

    if (!nezdarene.length) {
      // Dřív tu stálo „za 24 hodin se nepodařilo odeslat ani jeden" — věta,
      // která u zeleného ✓ čte přesně obráceně, než jak to je.
      return { stav: "ok", zprava: "za 24 hodin neselhal ani jeden" }
    }

    return {
      stav: "chyba",
      zprava: `za 24 hodin se nepodařilo odeslat ${nezdarene.length} e-mailů zákazníkům`,
      detail: podrobnosti(
        nezdarene.map(
          (zaznam) =>
            `${kdy(zaznam.created_at)} · šablona „${text(
              zaznam.template ?? "neznámá"
            )}" · ${text(zaznam.to)}`
        )
      ),
    }
  },
}

/**
 * Autorizováno a nezachyceno. Tohle je podpis nenastavené notifikační URL
 * u ComGate: zákazník zaplatil, brána to ví, obchod ne. Stálo to už třikrát,
 * proto to hlídá hlídka, ne jen smiřovací úloha.
 */
const platby: Kontrola = {
  klic: "platby",
  nazev: "Platby",
  spust: async (c) => {
    const query = (c as MedusaContainer).resolve(ContainerRegistrationKeys.QUERY)
    const hranice = new Date(Date.now() - LHUTA_ZACHYCENI)

    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "currency_code",
        "status",
        "payment_collections.status",
        "payment_collections.amount",
        "payment_collections.captured_amount",
      ],
      filters: { created_at: { $lt: hranice } },
      pagination: { take: 200, order: { created_at: "DESC" } },
    })

    const visi = (data as Record<string, unknown>[]).filter(
      (objednavka) =>
        String(objednavka.status) !== "canceled" &&
        ((objednavka.payment_collections ?? []) as Record<string, unknown>[]).some(
          (sbirka) =>
            String(sbirka.status) === "authorized" &&
            naCislo(sbirka.captured_amount) < naCislo(sbirka.amount) - 0.005
        )
    )

    if (!visi.length) {
      return { stav: "ok", zprava: "žádná nezůstala autorizovaná bez zachycení" }
    }

    return {
      stav: "chyba",
      zprava:
        `${visi.length} objednávek má přes dvě hodiny autorizovanou, ale ` +
        "nezachycenou platbu — typicky nenastavená notifikační URL u ComGate",
      detail: podrobnosti(
        visi.map((objednavka) => {
          const sbirka = (
            (objednavka.payment_collections ?? []) as Record<string, unknown>[]
          ).find((s) => String(s.status) === "authorized")
          return (
            `${cislo(objednavka)} · objednáno ${kdy(objednavka.created_at)} · ` +
            `autorizováno ${naCislo(sbirka?.amount)}, zachyceno ${naCislo(
              sbirka?.captured_amount
            )} ${String(objednavka.currency_code ?? "").toUpperCase()}`
          )
        })
      ),
    }
  },
}

/**
 * Zaplaceno bez faktury — přesně to, co se stalo u #68: záloha dorazila,
 * doklad nevznikl a v metadatech nebylo ani chybové hlášení. Kontroluje se
 * obojí: chybějící doklad i uložená chyba z iDokladu.
 */
const faktury: Kontrola = {
  klic: "faktury",
  nazev: "Faktury v iDokladu",
  spust: async (c) => {
    const query = (c as MedusaContainer).resolve(ContainerRegistrationKeys.QUERY)
    const hranice = new Date(Date.now() - LHUTA_FAKTURY)

    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "metadata",
        "payment_collections.captured_amount",
      ],
      filters: { created_at: { $lt: hranice } },
      pagination: { take: 200, order: { created_at: "DESC" } },
    })

    const bezDokladu: string[] = []
    const sChybou: string[] = []

    for (const objednavka of data as Record<string, unknown>[]) {
      const metadata = (objednavka.metadata ?? {}) as Record<string, unknown>

      for (const klice of [IDOKLAD_METADATA_KEYS, IDOKLAD_BALANCE_METADATA_KEYS]) {
        const chyba = metadata[klice.error]
        if (chyba) {
          sChybou.push(`${cislo(objednavka)} · ${klice.error}: ${text(chyba)}`)
        }
      }

      /* Nulová objednávka (plně krytá poukazem, cena po domluvě před
         domluvou) doklad nedostává — nic se nezachytilo. */
      const zachyceno = soucetZachyceneho(objednavka)
      if (zachyceno < 0.005) continue

      const maDoklad =
        metadata[IDOKLAD_METADATA_KEYS.invoiceId] ||
        metadata[IDOKLAD_BALANCE_METADATA_KEYS.invoiceId]

      if (!maDoklad) {
        bezDokladu.push(
          `${cislo(objednavka)} · objednáno ${kdy(objednavka.created_at)} · ` +
            `zachyceno ${zachyceno} · v metadatech není doklad ani chyba`
        )
      }
    }

    const vsechno = [...bezDokladu, ...sChybou]
    if (!vsechno.length) {
      return { stav: "ok", zprava: "každá zaplacená objednávka má doklad" }
    }

    return {
      stav: "chyba",
      zprava:
        [
          bezDokladu.length ? `${bezDokladu.length} zaplacených bez faktury` : "",
          sChybou.length ? `${sChybou.length} s chybou z iDokladu` : "",
        ]
          .filter(Boolean)
          .join(", ") +
        ". Zkontrolujte i to, že v Nastavení není zapnutý zkušební režim — " +
        "s ním se nefakturuje záměrně.",
      detail: podrobnosti(vsechno),
    }
  },
}

/**
 * Zaplaceno a po dvou dnech neodeslané. Není to vždy chyba stroje — může to
 * být i zapomenutá zásilka, a to je přesně ten případ, o kterém se jinak
 * nikdo nedozví.
 *
 * ## Co se do toho nepočítá (4. 11. 2026)
 *
 * **Osobní odběr.** Taková objednávka se nikdy neodešle — zákazník si pro ni
 * přijde a zaplatit může až u pultu. Hlídka jich 3. 11. nahlásila 35 „bez
 * odeslání", z toho většinu odběrů, a tím se celé hlášení stalo nečitelným:
 * mezi odběry se ztratily dvě zásilky, které opravdu ležely.
 *
 * **Objednávka úplně bez dopravy.** Elektronický poukaz se neposílá
 * (`requires_shipping: false`), takže není co podat.
 *
 * Číst osobní odběr je ošemetné: po výměně dopravy u zakázky může na metodě
 * zůstat starý příznak, proto se používá `isPersonalPickupOrder` — kód
 * služby dopravce přebíjí příznak odběru (lib/personal-pickup).
 */
const zasilky: Kontrola = {
  klic: "zasilky",
  nazev: "Odeslání zásilek",
  spust: async (c) => {
    const query = (c as MedusaContainer).resolve(ContainerRegistrationKeys.QUERY)
    const hranice = new Date(Date.now() - LHUTA_ODESLANI)

    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "fulfillment_status",
        "status",
        "payment_collections.captured_amount",
        "shipping_methods.name",
        // Kvůli `isPersonalPickupOrder`: rozhoduje `service_code`, ne název.
        "shipping_methods.data",
      ],
      filters: { created_at: { $lt: hranice } },
      pagination: { take: 200, order: { created_at: "DESC" } },
    })

    const lezi = (data as Record<string, unknown>[]).filter(cekaNaOdeslani)

    if (!lezi.length) {
      return {
        stav: "ok",
        zprava:
          "nic zaplaceného neleží přes dva dny bez odeslání (osobní odběr se nepočítá)",
      }
    }

    return {
      stav: "chyba",
      zprava: `${lezi.length} zaplacených objednávek leží přes dva dny bez odeslání`,
      detail: podrobnosti(
        lezi.map(
          (objednavka) =>
            `${cislo(objednavka)} · objednáno ${kdy(objednavka.created_at)} · ` +
            text(
              ((objednavka.shipping_methods ?? []) as Record<string, unknown>[])[0]
                ?.name ?? "bez způsobu dopravy"
            )
        )
      ),
    }
  },
}

/**
 * Skladová položka bez úrovně. Prodej takové varianty padal na 404 při
 * dokončení košíku — zákazník zaplatil a objednávka nevznikla, což je
 * nejhorší možná chyba, protože se o ní nedozví ani on, ani obchod.
 */
const sklad: Kontrola = {
  klic: "sklad",
  nazev: "Skladové úrovně",
  spust: async (c) => {
    const query = (c as MedusaContainer).resolve(ContainerRegistrationKeys.QUERY)

    const { data } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku", "location_levels.id"],
      pagination: { take: 1000 },
    })

    const bezUrovne = (data as Record<string, unknown>[]).filter(
      (polozka) => !((polozka.location_levels ?? []) as unknown[]).length
    )

    if (!bezUrovne.length) {
      return {
        stav: "ok",
        zprava: `všech ${data.length} skladových položek má úroveň`,
      }
    }

    return {
      stav: "chyba",
      zprava:
        `${bezUrovne.length} skladových položek nemá úroveň — prodej takové ` +
        "varianty padá na 404 při dokončení košíku",
      detail: podrobnosti(
        bezUrovne.map(
          (polozka) => `${text(polozka.sku ?? polozka.id)} · bez skladové úrovně`
        )
      ),
    }
  },
}

/**
 * Kolik z denních sta e-mailů je spotřebovaných. Nad limitem Resend odmítá
 * a zákazník nedostane ani potvrzení objednávky — proto to hlásí ještě PŘED
 * vyčerpáním, na osmdesáti procentech.
 */
const limitEmailu: Kontrola = {
  klic: "limit-emailu",
  nazev: "Denní limit e-mailů",
  spust: async (c) => {
    const notifications = (c as MedusaContainer).resolve(Modules.NOTIFICATION)

    /* Limit se resetuje o půlnoci UTC, takže se počítá od ní — ne od
       pražské půlnoci, jinak by hlídka v lednu počítala o hodinu jinak,
       než účtuje Resend. */
    const zacatekDne = new Date()
    zacatekDne.setUTCHours(0, 0, 0, 0)

    const dnes = (await notifications.listNotifications(
      { channel: "email", created_at: { $gte: zacatekDne } } as never,
      { take: DENNI_LIMIT_EMAILU + 50 }
    )) as unknown as unknown[]

    const zbyva = DENNI_LIMIT_EMAILU - dnes.length

    if (zbyva <= 0) {
      return {
        stav: "chyba",
        zprava:
          `denní limit ${DENNI_LIMIT_EMAILU} e-mailů je vyčerpaný (dnes ` +
          `${dnes.length}) — další e-maily zákazníkům neodejdou`,
        detail: [
          "Limit je na účtu Resend a resetuje se o půlnoci UTC.",
          "Do té doby neodejde ani potvrzení objednávky.",
        ],
      }
    }

    if (dnes.length >= DENNI_LIMIT_EMAILU * 0.8) {
      return {
        stav: "chyba",
        zprava: `z denních ${DENNI_LIMIT_EMAILU} e-mailů zbývá jen ${zbyva}`,
        detail: [`Odesláno dnes: ${dnes.length}.`],
      }
    }

    return {
      stav: "ok",
      zprava: `odesláno dnes ${dnes.length} ze ${DENNI_LIMIT_EMAILU}`,
    }
  },
}

/**
 * Zapisuje se vůbec do deníku? Hlídka bez deníku tvrdí „nic neselhalo",
 * i kdyby se den neodehrálo nic — a to je nejtišší možná porucha.
 */
const denik: Kontrola = {
  klic: "denik",
  nazev: "Provozní deník",
  spust: async (c) => {
    const service = (c as MedusaContainer).resolve(
      ACTIVITY_LOG_MODULE
    ) as ActivityLogModuleService

    const [, pocet] = await service.listAndCountActivityEvents(
      { created_at: { $gte: new Date(Date.now() - DEN) } } as never,
      { take: 1 }
    )

    if (!pocet) {
      return {
        stav: "chyba",
        zprava: "za 24 hodin se nezapsal ani jeden záznam",
        detail: [
          "Buď se v obchodě opravdu nic nestalo, nebo přestal zapisovat " +
            "sběr v api/middlewares.ts a subscriberu provoz-events.",
        ],
      }
    }

    return { stav: "ok", zprava: `za 24 hodin ${pocet} záznamů` }
  },
}

/** Běží web? Jedna HTTP kontrola proti `/api/healthcheck` obchodu. */
const obchod: Kontrola = {
  klic: "obchod",
  nazev: "Obchod (web)",
  spust: async (): Promise<NalezKontroly> => {
    const zaklad = (
      process.env.STOREFRONT_PUBLIC_URL ||
      process.env.MEDUSA_STOREFRONT_URL ||
      ""
    ).replace(/\/+$/, "")

    if (!zaklad) {
      return {
        stav: "nenastaveno",
        zprava: "chybí STOREFRONT_PUBLIC_URL i MEDUSA_STOREFRONT_URL",
      }
    }

    const url = `${zaklad}/api/healthcheck`
    try {
      const odpoved = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      })
      if (!odpoved.ok) {
        return {
          stav: "chyba",
          zprava: `${url} odpovídá ${odpoved.status}`,
          detail: [
            `HTTP ${odpoved.status} ${odpoved.statusText}`,
            (await odpoved.text().catch(() => "")).slice(0, 400) ||
              "(prázdná odpověď)",
          ],
        }
      }
      return { stav: "ok", zprava: "odpovídá" }
    } catch (error) {
      return {
        stav: "chyba",
        zprava: `${url} neodpověděla`,
        detail: [String((error as Error)?.message ?? error)],
      }
    }
  },
}

/**
 * Měny obchodu. Prodává se v korunách a eurech (lib/currencies) — další měna
 * jde zapnout v administraci dvěma kliknutími a nikde jinde by to nebylo
 * vidět, dokud by ji zákazník neuviděl v pokladně.
 *
 * Region bez zemí se nepočítá: ten si nikdo nevybere, takže jeho měna nikam
 * nedosáhne. Produkci takový zůstal po zrušení zlotého (5. 11. 2026).
 */
const meny: Kontrola = {
  klic: "meny",
  nazev: "Měny obchodu",
  spust: async (c) => {
    const container = c as MedusaContainer
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const [obchod] = (await container
      .resolve(Modules.STORE)
      .listStores({}, { relations: ["supported_currencies"] })) as unknown as Record<
      string,
      unknown
    >[]

    const { data: regiony } = await query.graph({
      entity: "region",
      fields: ["id", "name", "currency_code", "countries.iso_2"],
      pagination: { take: 100 },
    })

    const spatne: string[] = []

    const nabizene = ((obchod?.supported_currencies ?? []) as Record<
      string,
      unknown
    >[]).map((mena) => ({
      kod: String(mena.currency_code ?? "").toLowerCase(),
      vychozi: Boolean(mena.is_default),
    }))

    for (const mena of nabizene) {
      if (!jeMenaObchodu(mena.kod)) {
        spatne.push(
          `obchod má zapnutou měnu ${mena.kod.toUpperCase()} — vypněte ji v Nastavení → Store`
        )
      }
    }

    const vychozi = nabizene.find((mena) => mena.vychozi)
    if (vychozi && vychozi.kod !== MENA_ZAKLADNI) {
      spatne.push(
        `výchozí měna obchodu je ${vychozi.kod.toUpperCase()}, ne ${MENA_ZAKLADNI.toUpperCase()} — kurzy ČNB se počítají od koruny, takže se cizí ceny přestanou přepočítávat`
      )
    }

    for (const region of regiony as Record<string, unknown>[]) {
      const zeme = ((region.countries ?? []) as Record<string, unknown>[]).length
      const kod = String(region.currency_code ?? "").toLowerCase()
      if (zeme && !jeMenaObchodu(kod)) {
        spatne.push(
          `region ${text(region.name)} účtuje v ${kod.toUpperCase()} (${zeme} zemí)`
        )
      }
    }

    if (!spatne.length) {
      return {
        stav: "ok",
        zprava: `obchod i regiony účtují jen v ${vypisMen()}`,
      }
    }

    return {
      stav: "chyba",
      zprava:
        `obchod počítá i s jinou měnou než ${vypisMen()} — ComGate ani iDoklad ` +
        "na ni nemají účet, takže platba i doklad skončí v cizí měně bez pokrytí",
      detail: podrobnosti(spatne),
    }
  },
}

/** Všechny kontroly v pořadí, v jakém se čtou v souhrnu. */
export const KONTROLY: Kontrola[] = [
  databaze,
  obchod,
  platby,
  faktury,
  emailyZakaznikum,
  limitEmailu,
  zasilky,
  sklad,
  meny,
  denik,
]
