import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { posliZkusebniEmaily } from "../lib/zkusebni-emaily"

/**
 * Zkouška routingu provozních zpráv (stránka „E-maily obchodu", D7).
 *
 * Pošle DVĚ zprávy skutečnou cestou, každou na svou adresu — e-mail obchodu
 * a vývojáři (`lib/zkusebni-emaily.ts`, totéž dělá tlačítko „Poslat zkušební
 * e-maily" v administraci). Zákazníkům nic.
 *
 * V produkci radši tlačítko: běží v nasazeném backendu s jeho klíčem Resendu.
 * Skript pouštěný lokálně proti produkční databázi by nastartoval celý backend
 * a mohl by sebrat produkční úlohy a události.
 *
 * Spuštění:
 *   npx medusa exec ./src/scripts/test-provozni-emaily.ts
 */
export default async function testProvozniEmaily({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { obchod, vyvojar } = await posliZkusebniEmaily(container)

  for (const [kdo, vysledek] of [
    ["Obchod (majitelka)", obchod],
    ["Vývojář", vyvojar],
  ] as const) {
    logger.info(
      `[zkouška e-mailů] ${kdo}: ${vysledek.adresa || "(nenastaveno)"} — ${vysledek.odeslani}, ` +
        `doručení ${vysledek.stav ?? "?"}${vysledek.resend_id ? `, Resend ${vysledek.resend_id}` : ""}`
    )
  }
}
