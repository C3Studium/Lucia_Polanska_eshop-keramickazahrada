import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  assignShippingProfile,
  productsMissingShippingProfile,
  resolveDefaultShippingProfile,
  SHIPPING_PROFILE_PRODUCT_FIELDS,
} from "../lib/shipping-profile-default"

/**
 * Doplní chybějící profil dopravy celému katalogu.
 *
 * Bez profilu se objednávka s takovým kusem nedokončí — Medusa ji odmítne
 * hláškou „The cart items require shipping profiles that are not satisfied by
 * the current shipping methods", a to až ve chvíli, kdy je zaplaceno. Proč se
 * to děje a co přesně Medusa porovnává, je v `lib/shipping-profile-default.ts`.
 *
 * Nové produkty tohle už potřebovat nemají — stará se o ně
 * `subscribers/default-shipping-profile.ts`. Tenhle skript je pro katalog, jak
 * stojí dnes, a jako způsob, jak profil doplnit po hromadném importu, který
 * běžel s vypnutým workerem.
 *
 * Spustit:  npx medusa exec ./src/scripts/assign-shipping-profile.ts
 * Idempotentní — produkty, které profil mají, se nechávají být.
 *
 * Přepínače:
 *   --dry-run   jen vypíše, co by udělal; nic nezapisuje
 *   --force     povolí běh i proti ostré databázi
 *
 * Pouští se taky sám před `medusa develop` (viz `dev` v package.json), aby
 * si to nikdo nemusel pamatovat při práci na místní databázi. Na ostré
 * databázi se sám nespustí — tam je doplnění profilů vědomé rozhodnutí, ne
 * vedlejší účinek startu serveru, a proto se musí říct `--force`.
 */
export default async function assignShippingProfileToCatalogue({
  container,
  args,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const prepinace = args ?? []
  const naSucho = prepinace.includes("--dry-run")
  const vynuceno = prepinace.includes("--force")

  /*
   * Ani selhání nesmí zastavit vývojový server: `dev` skript volá tenhle
   * soubor přes `&&`, takže nenulový návratový kód by znamenal, že po
   * nedostupné databázi nebo překlepu v datech vůbec nenaběhne Medusa.
   * Doplnění profilu je pomoc, ne podmínka běhu.
   */
  try {
    await doplnitProfily(container, logger, { naSucho, vynuceno })
  } catch (error) {
    logger.error(
      `[shipping-profile] Doplnění profilů selhalo: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

async function doplnitProfily(
  container: ExecArgs["container"],
  logger: { info: (m: string) => void; error: (m: string) => void },
  { naSucho, vynuceno }: { naSucho: boolean; vynuceno: boolean }
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  if (process.env.NODE_ENV === "production" && !vynuceno) {
    logger.info(
      "[shipping-profile] Ostrá databáze — samo se nic nedoplňuje. Vědomě: `npx medusa exec ./src/scripts/assign-shipping-profile.ts --force` (napřed s `--dry-run`)."
    )
    return
  }

  const profil = await resolveDefaultShippingProfile(container)

  if (!profil) {
    logger.error(
      "[shipping-profile] Výchozí profil dopravy se nepodařilo určit — obchod jich má víc a žádný není označený jako výchozí. Přiřaďte profil ručně v administraci."
    )
    return
  }

  logger.info(`[shipping-profile] Výchozí profil: ${profil.name} (${profil.id})`)

  // Po stránkách: katalog má stovky kusů a `query.graph` bez stránkování
  // vrací jen první dávku.
  const STRANKA = 200
  const chybejici: { id: string; title: string }[] = []
  let prohlednuto = 0
  let skip = 0

  for (;;) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: SHIPPING_PROFILE_PRODUCT_FIELDS,
      pagination: { skip, take: STRANKA },
    })

    if (!products.length) {
      break
    }

    prohlednuto += products.length
    chybejici.push(...productsMissingShippingProfile(products as any[]))

    if (products.length < STRANKA) {
      break
    }

    skip += STRANKA
  }

  if (!chybejici.length) {
    logger.info(
      `[shipping-profile] Prohlédnuto ${prohlednuto} produktů, profil mají všechny. Není co doplňovat.`
    )
    return
  }

  logger.info(
    `[shipping-profile] Bez profilu: ${chybejici.length} z ${prohlednuto}. Například: ${chybejici
      .slice(0, 5)
      .map((p) => p.title)
      .join(", ")}`
  )

  if (naSucho) {
    logger.info(
      "[shipping-profile] Suchý běh — nic se nezapsalo. Bez `--dry-run` by se profil doplnil právě těmto produktům."
    )
    return
  }

  await assignShippingProfile(
    container,
    chybejici.map((p) => p.id),
    profil.id
  )

  logger.info(
    `[shipping-profile] Doplněno u ${chybejici.length} produktů. Objednávky s nimi teď půjdou dokončit.`
  )
}
