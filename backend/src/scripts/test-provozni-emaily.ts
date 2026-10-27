import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getNotificationAddresses, notifyMerchant } from "../lib/notify"

/**
 * Zkouška routingu provozních zpráv (stránka „E-maily obchodu", D7).
 *
 * Pošle DVĚ zprávy skutečnou cestou (`notifyMerchant` → šablona
 * `merchant-notification` → Resend), každou na svou adresu:
 *
 *  - `audience: "owner"` → e-mail obchodu (majitelka),
 *  - `audience: "dev"`   → vývojářská adresa.
 *
 * Adresy se berou odtud, odkud je bere provoz: nastavení z administrace má
 * přednost, prázdné spadne na `OWNER/DEV_NOTIFICATION_EMAIL`. Skript je
 * nejdřív vypíše, takže je vidět, která adresa z které vrstvy platí — i když
 * by se e-mail nedoručil, ten výpis je sám o sobě odpověď na otázku „kam to
 * chodí".
 *
 * Klíč nese čas spuštění: provozní zprávy se schválně dedupují, zkouška se
 * ale musí dát spustit víckrát.
 *
 * Spuštění (lokálně proti produkční databázi a produkčnímu Resendu):
 *   npx medusa exec ./src/scripts/test-provozni-emaily.ts
 */
export default async function testProvozniEmaily({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const kdy = new Date().toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })

  const addresses = await getNotificationAddresses(container)
  logger.info(
    `[zkouška e-mailů] Platné adresy — obchod (majitelka): ${
      addresses.owner || "(nenastaveno)"
    }, vývojář: ${addresses.dev || "(nenastaveno)"}`
  )

  const owner = await notifyMerchant(container, {
    key: `test-provoz-owner:${stamp}`,
    title: "Zkušební zpráva — e-maily obchodu fungují",
    description:
      `Dobrý den, tohle je jen zkouška: ověřujeme, že vám provozní zprávy z obchodu (nová objednávka, zakázka, doplatek, souhrny) dorazí na tuhle adresu. Nic se nestalo a nic nemusíte dělat. Odesláno ${kdy}.`,
    audience: "owner",
    email: true,
  })

  const dev = await notifyMerchant(container, {
    key: `test-provoz-dev:${stamp}`,
    title: "Zkušební zpráva — vývojářská hlídka",
    description:
      `Kontrola routingu D7: tahle zpráva míří na vývojářskou adresu (nezdařené e-maily, chyby dopravce). Odesláno ${kdy}.`,
    audience: "dev",
    email: true,
  })

  logger.info(
    `[zkouška e-maily] Obchod: zvonek ${owner.feed ? "ano" : "ne"}, e-mail ${owner.email} → ${
      addresses.owner || "—"
    }`
  )
  logger.info(
    `[zkouška e-maily] Vývojář: zvonek ${dev.feed ? "ano" : "ne"}, e-mail ${dev.email} → ${
      addresses.dev || "—"
    }`
  )
}
