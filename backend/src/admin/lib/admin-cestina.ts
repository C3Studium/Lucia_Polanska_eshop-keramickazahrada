/**
 * Zbytky angličtiny a technické názvy v Medusině adminu (14. 11. 2026).
 *
 * Medusa má český překlad (zapíná se v `sdk.ts`), ale pár věcí nepřekládá:
 * id platebních poskytovatelů („Pp_comgate_comgate"), stav „Captured",
 * součet „Total pending", název prodejního kanálu a zemi v adrese. Tady je
 * přejmenujeme přímo ve stránce — jen přesné shody, nic jiného se nemění.
 *
 * K tomu karty „Metadata" a „JSON" na detailech: data pro vývojáře, pro
 * majitelku jen šum. Bez expertního režimu se schovají.
 */

/** Celý text uzlu (po ořezání mezer) → nový text. */
const CELE: Record<string, string> = {
  Pp_comgate_comgate: "Karta (ComGate)",
  "Pp_dobirka_ceska-Posta": "Dobírka (Česká pošta)",
  "Pp_osobni-odber_pickup": "Platba při osobním odběru",
  Pp_system_default: "Bez online platby",
  Captured: "Zaplaceno",
  "Total pending": "Zbývá zaplatit",
  "Czech Republic": "Česko",
}

/* Jen id plateb (začínají „pp_"), ne krátká slova jako „Captured" — ta
   musí sedět přesně, ať se nepřepíše nic, co Medusa už přeložila. */
const CELE_MALYMI: Record<string, string> = Object.fromEntries(
  Object.entries(CELE)
    .filter(([k]) => k.toLowerCase().startsWith("pp_"))
    .map(([k, v]) => [k.toLowerCase(), v])
)

/** Úsek uvnitř delšího textu. Jen dlouhé, jednoznačné fráze. */
const MESICE: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
}

const USEKY: Array<[RegExp, string | ((...m: string[]) => string)]> = [
  [/\bDefault Sales Channel\b/g, "e-shopu"],
  /* Řádek platby má datum napevno anglicky: „13 Nov, 2026". */
  [
    /\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec), (\d{4})\b/g,
    (_m, den, mesic, rok) => `${den}. ${MESICE[mesic]}. ${rok}`,
  ],
  /* Součty plateb: „Kč 679,00 CZK" → „679,00 Kč". */
  [/Kč\s([\d\s .,]+?)\sCZK/g, (_m, castka) => `${castka} Kč`],
]

/** Přeložený text, nebo `null`, když se nemá nic měnit. */
export const prelozText = (text: string): string | null => {
  const jadro = text.trim()
  if (!jadro) return null
  /* Id plateb jsou v DOM malými písmeny („pp_comgate_comgate"), velké
     P přidává až CSS — porovnává se tedy bez ohledu na velikost. */
  const cely = CELE[jadro] ?? CELE_MALYMI[jadro.toLowerCase()]
  if (cely !== undefined) return text.replace(jadro, cely)
  let vysledek = text
  for (const [vzor, nahrada] of USEKY) vysledek = vysledek.replace(vzor, nahrada as never)
  return vysledek === text ? null : vysledek
}

const TECHNICKE_NADPISY = new Set(["Metadata", "JSON"])

const projdi = (koren: Node) => {
  const chodec = document.createTreeWalker(koren, NodeFilter.SHOW_TEXT)
  let uzel: Node | null = chodec.currentNode
  if (uzel.nodeType !== Node.TEXT_NODE) uzel = chodec.nextNode()
  while (uzel) {
    const text = uzel.nodeValue ?? ""
    const novy = prelozText(text)
    if (novy !== null) uzel.nodeValue = novy
    if (TECHNICKE_NADPISY.has(text.trim())) {
      /* Karta = nejbližší kontejner se stínem karty (Medusin `Container`). */
      const karta = (uzel.parentElement?.closest(
        "[class*='shadow-elevation-card']"
      ) ?? null) as HTMLElement | null
      if (karta) karta.dataset.kzTech = "1"
    }
    uzel = chodec.nextNode()
  }
}

/**
 * Řádky, které nejsou zboží (balné, doběrečné). Medusa je na detailu
 * objednávky dává do druhé karty „Nesplněné položky", protože nemají výrobek
 * ani dopravu — majitelka pak viděla dvě karty a nevěděla proč.
 */
export const jenServisniRadky = (nazvyRadku: string[]): boolean =>
  nazvyRadku.length > 0 &&
  /* Bez `\b`: za „é" by hranici slova JS nenašel (bez /u to není písmeno). */
  nazvyRadku.every((nazev) => /^(↳\s*)?(Balné|Doběrečné)(?![\p{L}\d])/u.test(nazev.trim()))

const NADPISY_NESPLNENE = new Set(["Nesplněné položky", "Unfulfilled Items"])

/* Karta „Nesplněné položky" jen s balným/doběrečným → schovat (jsou v Souhrnu);
   v expertním režimu zůstává, stejně jako Metadata a JSON. */
const oznacServisniKarty = () => {
  document.querySelectorAll("h2").forEach((nadpis) => {
    if (!NADPISY_NESPLNENE.has((nadpis.textContent ?? "").trim())) return
    const karta = nadpis.closest("[class*='shadow-elevation-card']") as HTMLElement | null
    if (!karta || karta.querySelector("img")) return
    /* Text pod hlavičkou karty (první dítě = nadpis a štítky stavu), bez
       částek a množství — zbydou názvy řádků (a u zboží SKU a varianta). */
    const nazvy = [...karta.children]
      .slice(1)
      .flatMap((el) => ((el as HTMLElement).innerText ?? "").split("\n"))
      .map((t) => t.trim())
      .filter((t) => t && !/^\d/.test(t) && !/(Kč|CZK|€|EUR)$/.test(t))
    if (jenServisniRadky(nazvy)) karta.dataset.kzTech = "1"
  })
}

export const spustCestinu = () => {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return
  let naplanovano = false
  const start = () => {
    projdi(document.body)
    oznacServisniKarty()
    new MutationObserver((zmeny) => {
      for (const zmena of zmeny) {
        if (zmena.type === "characterData") {
          const novy = prelozText(zmena.target.nodeValue ?? "")
          if (novy !== null) zmena.target.nodeValue = novy
        } else {
          zmena.addedNodes.forEach((n) => projdi(n))
        }
      }
      /* Karty se skládají postupně — kontrola jednou za snímek stačí. */
      if (!naplanovano) {
        naplanovano = true
        requestAnimationFrame(() => {
          naplanovano = false
          oznacServisniKarty()
        })
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  }
  if (document.body) start()
  else window.addEventListener("DOMContentLoaded", start, { once: true })
}
