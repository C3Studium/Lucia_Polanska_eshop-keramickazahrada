import type { DruhProvozu } from "./zapis"
import { jeRadekFronty } from "./fronta"

/**
 * Souhrn deníku — čisté sčítání (3. 11. 2026).
 *
 * Denní e-mail má odpovědět na otázku „proběhlo všechno, co mělo?". Na tu
 * neodpoví seznam chyb: když se za celý den nezachytila ani jedna platba,
 * žádná chyba nevznikne a přesto je něco špatně. Proto se počítá, co se
 * stalo, ne jen co spadlo.
 *
 * Oddělené od čtení z databáze schválně — na tvaru e-mailu záleží a naživo
 * se zkouší nejhůř.
 */

export type ZaznamProvozu = {
  kind: string
  action: string
  status: string
  summary?: string | null
  detail?: unknown
  created_at?: string | Date
  ref_type?: string | null
  ref_id?: string | null
}

/** Jak se druh jmenuje v e-mailu. Neznámý druh se ukáže, jak je zapsaný. */
const NAZVY: Record<DruhProvozu | string, string> = {
  platba: "Platby",
  faktura: "Faktury",
  email: "E-maily",
  objednavka: "Objednávky",
  zakazka: "Zakázky",
  reklamace: "Reklamace a vrácení",
  poukaz: "Dárkové poukazy",
  kurz: "Kurzy",
  prihlaseni: "Přihlášení v obchodě",
  admin: "Změny v administraci",
  obchod: "Nákupní cesta",
  uloha: "Úlohy na pozadí",
  web: "Chyby webu",
}

/**
 * Pořadí v e-mailu: nahoře to, co stojí peníze, dole technika. Druh, který
 * tu není, se připojí na konec podle abecedy — nový druh se tedy objeví
 * sám, i když si na něj tenhle seznam nevzpomene.
 */
const PORADI: string[] = [
  "platba",
  "faktura",
  "objednavka",
  "zakazka",
  "reklamace",
  "poukaz",
  "kurz",
  "email",
  "prihlaseni",
  "obchod",
  "admin",
  "uloha",
  "web",
]

/**
 * Deník bez účetnictví fronty — viz `jeRadekFronty`. Filtruje se tady, ne
 * jen v dotazu: na obsahu večerního souhrnu záleží a tohle jde ověřit testem.
 */
const bezUcetnictvi = (zaznamy: ZaznamProvozu[]): ZaznamProvozu[] =>
  zaznamy.filter((zaznam) => !jeRadekFronty(zaznam))

export type SouctyDruhu = {
  druh: string
  nazev: string
  ok: number
  chyby: number
}

export const soucty = (zaznamy: ZaznamProvozu[]): SouctyDruhu[] => {
  const mapa = new Map<string, { ok: number; chyby: number }>()

  for (const zaznam of bezUcetnictvi(zaznamy)) {
    const stav = mapa.get(zaznam.kind) ?? { ok: 0, chyby: 0 }
    if (zaznam.status === "chyba") stav.chyby += 1
    else stav.ok += 1
    mapa.set(zaznam.kind, stav)
  }

  return [...mapa.entries()]
    .map(([druh, stav]) => ({
      druh,
      nazev: NAZVY[druh] ?? druh,
      ok: stav.ok,
      chyby: stav.chyby,
    }))
    .sort((a, b) => {
      const ia = PORADI.indexOf(a.druh)
      const ib = PORADI.indexOf(b.druh)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.nazev.localeCompare(b.nazev, "cs")
    })
}

/** „3× proběhlo" · „3× proběhlo, 1× selhalo". */
const radekSouctu = (soucet: SouctyDruhu): string => {
  const casti = [`${soucet.ok}× proběhlo`]
  if (soucet.chyby) casti.push(`${soucet.chyby}× selhalo`)
  return `${soucet.chyby ? "✗" : "✓"} ${soucet.nazev} — ${casti.join(", ")}`
}

/**
 * Nejčastější akce v druhu — aby bylo vidět, že „Změny v administraci: 23×"
 * znamená hlavně ukládání produktů, a ne třiadvacet pokusů o totéž.
 */
export const nejcastejsiAkce = (
  zaznamy: ZaznamProvozu[],
  druh: string,
  kolik = 3
): string[] => {
  const mapa = new Map<string, number>()
  for (const zaznam of zaznamy) {
    if (zaznam.kind !== druh) continue
    mapa.set(zaznam.action, (mapa.get(zaznam.action) ?? 0) + 1)
  }
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, kolik)
    .map(([akce, pocet]) => `${akce} (${pocet}×)`)
}

/** Selhání z deníku, s podrobnostmi — to, co jde vložit do chatu. */
export const selhani = (zaznamy: ZaznamProvozu[], kolik = 20): string[] => {
  const chyby = bezUcetnictvi(zaznamy).filter(
    (zaznam) => zaznam.status === "chyba"
  )
  const radky = chyby.map((zaznam) => {
    const detail = zaznam.detail as Record<string, unknown> | null | undefined
    const duvod = detail?.chyba ?? detail?.stav ?? null
    /*
     * Sběr z HTTP zapisuje tutéž větu dvakrát — jako `detail.chyba` i jako
     * `summary` (sber.ts). V souhrnu z toho bylo „odpověď 400 · odpověď 400",
     * což vypadá jako dvě chyby. Shodný popis se tedy vypíše jednou.
     */
    const popis = zaznam.summary && String(duvod ?? "") !== zaznam.summary
      ? zaznam.summary
      : null
    return (
      `${NAZVY[zaznam.kind] ?? zaznam.kind} · ${zaznam.action}` +
      (zaznam.ref_id ? ` · ${zaznam.ref_type ?? "ref"} ${zaznam.ref_id}` : "") +
      (duvod ? ` · ${String(duvod)}` : "") +
      (popis ? ` · ${popis}` : "")
    )
  })
  return radky.length > kolik
    ? [...radky.slice(0, kolik), `…a dalších ${radky.length - kolik}`]
    : radky
}

/**
 * Část denního e-mailu o tom, co se stalo. Když se nestalo nic, řekne to
 * naplno: prázdný den není „v pořádku", je to otázka.
 */
export const textDeniku = (zaznamy: ZaznamProvozu[]): string => {
  if (!zaznamy.length) {
    return (
      "Za celý den se nezapsala ani jedna akce. Buď byl obchod opravdu " +
      "bez provozu, nebo přestal zapisovat sběr — viz kontrola Provozní deník."
    )
  }

  const radky: string[] = []
  for (const soucet of soucty(zaznamy)) {
    radky.push(radekSouctu(soucet))
    const akce = nejcastejsiAkce(zaznamy, soucet.druh)
    if (akce.length) {
      radky.push(`    ${akce.join(" · ")}`)
    }
  }

  const chyby = selhani(zaznamy)
  if (chyby.length) {
    radky.push("", "Co selhalo:")
    for (const radek of chyby) {
      radky.push(`· ${radek}`)
    }
  }

  return radky.join("\n")
}
