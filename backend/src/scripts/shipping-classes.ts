import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SHIPPING_CLASSES, shippingClassOf } from "../lib/shipping-rates"
import { ensureShippingSetup } from "../lib/shipping-setup"

/**
 * Migrace: třídy zásilek a druhy dopravy (16.–17. 11. 2026, Matěj).
 *
 * 1. Výrobek bez `metadata.shipping_class` dostane třídu: dárkový poukaz
 *    `poukaz`, ostatní `male`. Velké kusy pak označí majitelka v Produkty+.
 * 2. Volby dopravy České pošty na čtyři druhy (lib/shipping-setup) — totéž
 *    udělá i první uložení cen v Nastavení obchodu › Doprava a platba.
 *
 * Opakovatelná; chyba se jen zaloguje, nasazení nezastaví.
 * Ručně:  npx medusa exec ./src/scripts/shipping-classes.ts
 */
export default async function shippingClasses({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const productModule: any = container.resolve(Modules.PRODUCT)
    const products: any[] = await productModule.listProducts({}, { select: ["id", "metadata"], take: 100000 })
    let classed = 0
    for (const product of products) {
      const meta = (product.metadata ?? {}) as Record<string, unknown>
      if ((SHIPPING_CLASSES as string[]).includes(String(meta.shipping_class ?? ""))) continue
      await productModule.updateProducts(product.id, {
        metadata: { ...meta, shipping_class: shippingClassOf(meta) },
      })
      classed += 1
    }
    logger.info(`[zásilky] Třída doplněna u ${classed} výrobků.`)
  } catch (error: any) {
    logger.error(`[zásilky] Třídy výrobků selhaly: ${error?.message ?? error}`)
  }

  try {
    const result = await ensureShippingSetup(container)
    logger.info(
      `[zásilky] Volby dopravy: nové ${result.created.join(", ") || "žádné"}; ` +
        `odebrané ${result.removed.join(", ") || "žádné"}; ` +
        `na vypočtenou cenu ${result.switched.join(", ") || "žádné"}.`
    )
  } catch (error: any) {
    logger.error(`[zásilky] Nastavení voleb dopravy selhalo: ${error?.message ?? error}`)
  }
}
