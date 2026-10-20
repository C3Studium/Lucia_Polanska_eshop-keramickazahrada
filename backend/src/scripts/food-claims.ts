import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Tvrzení o zdravotní nezávadnosti / vhodnosti pro potraviny v popisech
 * produktů (LEGAL_AUDIT.md § 0b, N1 — nařízení (ES) č. 1935/2004, vyhláška
 * č. 38/2001 Sb.). Takové tvrzení smí v popisu stát jen u glazury, ke které
 * existuje protokol o nezávadnosti zveřejněný na /certifikaty.
 *
 *   npx medusa exec ./src/scripts/food-claims.ts            # vypíše produkty s tvrzením (nasucho)
 *   npx medusa exec ./src/scripts/food-claims.ts strip      # věty s tvrzením z popisu odstraní (původní popis
 *                                                           #   uloží do metadata.food_claim_backup)
 *   npx medusa exec ./src/scripts/food-claims.ts restore    # popis vrátí ze zálohy a zálohu smaže
 *
 * Pozor: `medusa exec` volby typu `--strip` odmítá — argumenty bez pomlček.
 * Nikdy neodstraňuje nic, co není celá věta s tvrzením; popis zůstává jinak
 * beze změny, takže `restore` vrací přesně původní text.
 */

/** Věta (až po tečku / konec řádku) obsahující tvrzení o nezávadnosti nebo potravinách. */
export const FOOD_CLAIM_SENTENCE =
  /[^.\n]*(zdravotně\s+nezávadn|nezávadn[ýáéí]\w*\s+(materi|glaz)|pro\s+styk\s+s\s+potravin|vhodn\w*\s+(na|pro)\s+potravin)[^.\n]*[.!]?/gi

/** Negace („není vhodný pro styk s potravinami“) tvrzením není — ta musí zůstat. */
const isNegated = (sentence: string): boolean => /\bnen[íi]\b|\bnevhodn|nepouž/i.test(sentence)

export const stripFoodClaims = (description: string): { next: string; removed: string[] } => {
  const removed: string[] = []
  const next = description
    .replace(FOOD_CLAIM_SENTENCE, (sentence) => {
      if (isNegated(sentence)) return sentence
      removed.push(sentence.trim())
      return ""
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return { next, removed }
}

export default async function foodClaims({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)
  const mode = args.includes("strip") ? "strip" : args.includes("restore") ? "restore" : "list"

  const products = await productModule.listProducts(
    {},
    { select: ["id", "title", "handle", "description", "metadata"], take: 1000 }
  )

  let touched = 0
  for (const product of products as any[]) {
    const metadata = (product.metadata ?? {}) as Record<string, unknown>
    if (mode === "restore") {
      const backup = metadata.food_claim_backup
      if (typeof backup !== "string") continue
      await productModule.updateProducts(product.id, {
        description: backup,
        metadata: { ...metadata, food_claim_backup: "" },
      })
      touched += 1
      logger.info(`[nezávadnost] ${product.title}: popis vrácen ze zálohy.`)
      continue
    }
    const { next, removed } = stripFoodClaims(String(product.description ?? ""))
    if (!removed.length) continue
    touched += 1
    if (mode === "list") {
      logger.info(`[nezávadnost] ${product.title} (${product.handle}):\n    • ${removed.join("\n    • ")}`)
      continue
    }
    await productModule.updateProducts(product.id, {
      description: next,
      metadata: { ...metadata, food_claim_backup: String(product.description ?? "") },
    })
    logger.info(`[nezávadnost] ${product.title}: odstraněno ${removed.length} vět, původní popis v metadata.food_claim_backup.`)
  }

  logger.info(
    mode === "list"
      ? `[nezávadnost] Nasucho: ${touched} produktů s tvrzením o nezávadnosti. Odstranění: argument strip; vrácení: restore.`
      : `[nezávadnost] Hotovo (${mode}): ${touched} produktů.`
  )
}
