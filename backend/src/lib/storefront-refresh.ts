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
