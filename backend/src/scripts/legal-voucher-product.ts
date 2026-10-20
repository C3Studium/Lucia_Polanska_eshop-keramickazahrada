import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { VOUCHER_DEFAULTS, VOUCHER_FLAG } from "../lib/voucher"

/**
 * Přepne produkt „Dárkový poukaz … 1 Kč" na poukaz s vlastní částkou
 * (právní audit § 5, docs/legal/OPEN_QUESTIONS.md bod 13).
 *
 * Dnes: cena 1 Kč a v popisu „objednejte a libovolnou částku převeďte na
 * účet" — cena v košíku neodpovídá platbě (§ 1820, § 1826a OZ). Po přepnutí
 * si zákazník částku zvolí na stránce produktu a ta se stane cenou řádku
 * (`lib/voucher.ts`, krok `get-custom-price`).
 *
 * Skript jen nastaví metadata (`voucher_custom_amount`, `voucher_min`,
 * `voucher_max`, `voucher_step`). Popis NEMĚNÍ — vypíše řádky, které je
 * potřeba v administraci upravit ručně (poštovné „60 Kč" v rozporu s ceníkem,
 * soukromý gmail, pokyn k převodu „libovolné částky").
 *
 * Výchozí běh je NAČISTO (nic nezapíše):
 *   npx medusa exec ./src/scripts/legal-voucher-product.ts
 * Zápis:
 *   npx medusa exec ./src/scripts/legal-voucher-product.ts apply [id=prod_…] [min=100] [max=10000] [step=100]
 *
 * Najde-li víc kandidátů, zapíše jen s `id=…`.
 *
 * Pozor: `medusa exec` předává skriptu jen poziční argumenty — volbu typu
 * `--apply` odmítne („Unknown argument: apply“, ověřeno na produkci 20. 10.).
 * Proto se píše bez pomlček (`apply`, `id=…`); tvar s `--` funguje jen
 * v testech a v sandboxu, kde se skript volá přímo.
 */

const TITLE_PATTERN = /d[áa]rkov[ýy]\s+poukaz/i
const ONE_CROWN_TITLE = /(^|[^\d])1\s*(kč|czk)/i
const DESCRIPTION_FLAGS: { pattern: RegExp; why: string }[] = [
  { pattern: /60\s*(kč|,-)/i, why: "poštovné 60 Kč — neodpovídá ceníku dopravy" },
  { pattern: /[a-z0-9._%+-]+@gmail\.com/i, why: "soukromý e-mail (gmail) — patří sem info@keramickazahrada.cz" },
  { pattern: /libovoln\S*\s+částk|převeďte|převodem/i, why: "pokyn k převodu libovolné částky — částku teď zákazník zadá přímo" },
]

const argValue = (args: string[], name: string): string | null => {
  const hit = args
    .map((arg) => arg.replace(/^--/, ""))
    .find((arg) => arg.startsWith(`${name}=`))
  return hit ? hit.slice(name.length + 1).trim() : null
}

const intArg = (args: string[], name: string, fallback: number): number => {
  const raw = argValue(args, name)
  const value = raw === null ? NaN : Number(raw)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

/** Popis → řádky čistého textu (bez HTML), aby šly vypsat a najít. */
const descriptionLines = (description: string | null | undefined): string[] =>
  String(description ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

export default async function legalVoucherProduct({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const apply = args.includes("apply") || args.includes("--apply")
  const pickId = argValue(args, "id")

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "description",
      "metadata",
      "variants.id",
      "variants.title",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    filters: { title: { $ilike: "%poukaz%" } } as never,
  })

  const candidates = (data as any[]).filter((product) => {
    if (!TITLE_PATTERN.test(String(product.title ?? ""))) return false
    const oneCrownPrice = (product.variants ?? []).some((variant: any) =>
      (variant.prices ?? []).some(
        (price: any) =>
          String(price.currency_code).toLowerCase() === "czk" && Number(price.amount) === 1
      )
    )
    return ONE_CROWN_TITLE.test(String(product.title ?? "")) || oneCrownPrice
  })

  if (!candidates.length) {
    logger.info(
      "[poukaz] Žádný produkt „Dárkový poukaz … 1 Kč“ nenalezen (hledá se název s „dárkový poukaz“ a cenou / názvem 1 Kč)."
    )
    return
  }

  const patchFor = (product: any) => {
    const meta = (product.metadata ?? {}) as Record<string, unknown>
    return {
      [VOUCHER_FLAG]: true,
      voucher_min: intArg(args, "min", Number(meta.voucher_min) || VOUCHER_DEFAULTS.min),
      voucher_max: intArg(args, "max", Number(meta.voucher_max) || VOUCHER_DEFAULTS.max),
      voucher_step: intArg(args, "step", Number(meta.voucher_step) || VOUCHER_DEFAULTS.step),
    }
  }

  for (const product of candidates) {
    const meta = (product.metadata ?? {}) as Record<string, unknown>
    const patch = patchFor(product)
    logger.info(
      [
        "",
        `[poukaz] ${product.title} (${product.id}, /${product.handle}, ${product.status})`,
        `  metadata teď: ${JSON.stringify({
          [VOUCHER_FLAG]: meta[VOUCHER_FLAG] ?? null,
          voucher_min: meta.voucher_min ?? null,
          voucher_max: meta.voucher_max ?? null,
          voucher_step: meta.voucher_step ?? null,
        })}`,
        `  nastaví se:   ${JSON.stringify(patch)}`,
      ].join("\n")
    )

    const flagged = descriptionLines(product.description).flatMap((line) =>
      DESCRIPTION_FLAGS.filter((flag) => flag.pattern.test(line)).map(
        (flag) => `    • „${line}“\n      → ${flag.why}`
      )
    )
    if (flagged.length) {
      logger.info(
        ["  Popis upravte ručně v administraci (skript ho nemění):", ...flagged].join("\n")
      )
    } else {
      logger.info("  V popisu nic k úpravě nenalezeno.")
    }
  }

  if (!apply) {
    logger.info(
      "\n[poukaz] Načisto — nic se nezapsalo. Zápis: přidejte apply (u víc kandidátů i id=prod_…)."
    )
    return
  }

  const targets = pickId
    ? candidates.filter((product) => product.id === pickId)
    : candidates.length === 1
      ? candidates
      : []

  if (!targets.length) {
    logger.error(
      pickId
        ? `[poukaz] Produkt ${pickId} mezi kandidáty není — nic se nezapsalo.`
        : `[poukaz] Kandidátů je ${candidates.length} — vyberte jednoho přes --id=prod_… Nic se nezapsalo.`
    )
    return
  }

  const productModule = container.resolve(Modules.PRODUCT) as any
  for (const product of targets) {
    // Metadata se slučují — posílá se jen patch, ostatní klíče zůstanou.
    await productModule.updateProducts(product.id, { metadata: patchFor(product) })
    logger.info(`[poukaz] ${product.title} (${product.id}): metadata poukazu nastavena.`)
  }
  logger.info(
    "[poukaz] Hotovo. Nezapomeňte upravit popis (viz výše) a zkontrolovat produkt na webu."
  )
}
