import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Požádá obchod o obnovu dat po uložení v administraci (15. 11. 2026).
 *
 * Právní údaje a Texty obchodu se propisují do patičky, pokladny, podmínek
 * i stránek výrobků. Obchod je drží v mezipaměti (minuta a déle), takže
 * uložená změna na webu chvíli nebyla vidět — majitelka měla dojem, že se
 * neuložila. Volá `/api/revalidate` obchodu se štítky dat a s „everything"
 * (zahodit všechny uložené stránky).
 *
 * Nikdy nevyhodí: obnova je úklid po zápisu, ne jeho součást. Bez adresy
 * obchodu nebo tajemství (vývoj) se tiše přeskočí.
 */
export const refreshStorefront = async (
  container: MedusaContainer,
  body: { tags?: string[]; everything?: boolean; paths?: string[] }
): Promise<void> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const base = (process.env.STOREFRONT_PUBLIC_URL || process.env.MEDUSA_STOREFRONT_URL || "").replace(/\/+$/, "")
  const secret = process.env.REVALIDATE_SECRET
  if (!base || !secret) return
  try {
    const response = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      logger.warn(`[revalidate] Obchod odmítl obnovu (${JSON.stringify(body)}): HTTP ${response.status}.`)
    }
  } catch (error) {
    logger.warn(
      `[revalidate] Obnovu obchodu se nepodařilo vyžádat: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/*
 * Obnova obchodu po KAŽDÉM uložení v administraci (18. 11. 2026, přání
 * majitele: „změna musí být vidět hned — backend zavolá obchod, jinak nic
 * nekontrolovat"). Dřív obchod klepaly jen vybrané události (výrobky,
 * kolekce, slevy, texty); fotky, nastavení, kurzy, poukazy a další se
 * propsaly až po vypršení mezipaměti.
 *
 * Middleware na /admin/*: když zápis (POST/PUT/PATCH/DELETE) skončí
 * úspěchem, za chvilku pošle obchodu jedno „everything". Víc uložení těsně
 * po sobě (hromadné úpravy, přetažení fotek) se sloučí do jednoho klepnutí.
 * Obchod pak obnoví mezipaměť a dá vědět otevřeným záložkám (/api/live).
 */
const ZAPIS = new Set(["POST", "PUT", "PATCH", "DELETE"])
const SLOUCENI_MS = 700
let odlozeno: ReturnType<typeof setTimeout> | null = null

export const obnovaObchoduPoZapisu = () => {
  return (req: any, res: any, next: () => void) => {
    if (ZAPIS.has(String(req.method).toUpperCase())) {
      res.on("finish", () => {
        if (res.statusCode >= 400) return
        if (odlozeno) clearTimeout(odlozeno)
        odlozeno = setTimeout(() => {
          odlozeno = null
          void refreshStorefront(req.scope, { everything: true })
        }, SLOUCENI_MS)
      })
    }
    next()
  }
}
