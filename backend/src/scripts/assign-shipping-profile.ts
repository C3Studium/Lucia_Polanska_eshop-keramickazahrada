import { updateProductsWorkflow } from "@medusajs/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  assignShippingProfile,
  productsMissingShippingProfile,
  resolveDefaultShippingProfile,
  shippingProfileSummary,
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
 * ### Pozor na `--` před přepínači
 *
 * Medusa registruje příkaz jako `exec [file] [args..]` a nenastavuje
 * `unknown-options-as-args`. yargs proto `--dry-run` odmítne hláškou
 * „Unknown arguments" ještě dřív, než se skript spustí. Oddělovač `--` ho
 * odzbrojí:
 *
 *     npx medusa exec ./src/scripts/assign-shipping-profile.ts -- --dry-run --force
 *
 * Kde se s uvozovkami bojuje špatně (Railway, CI), fungují i proměnné:
 * SHIPPING_PROFILE_DRY_RUN, SHIPPING_PROFILE_FORCE, SHIPPING_PROFILE_ALL
 * a SHIPPING_PROFILE_ONLY (seznam oddělený čárkou).
 *
 * Přepínače:
 *   --dry-run       jen vypíše, co by udělal; nic nezapisuje
 *   --force         povolí běh i proti ostré databázi
 *   --only=a,b,c    jen tyhle produkty (id nebo handle) — na vyzkoušení
 *                   celého průchodu na jednom kusu, než se sáhne na katalog
 *   --all           i produkty, které profil UŽ MAJÍ — srovná celý katalog
 *                   na výchozí profil. Přepisuje rozhodnutí, která někdo
 *                   udělal vědomě (křehké, nadrozměr), proto zvlášť.
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

  /*
   * Přepínače se čtou i z `process.argv`, nejen z `args`.
   *
   * Medusa registruje příkaz jako `exec [file] [args..]` a — na rozdíl od
   * `mcloud` hned vedle — nenastavuje `unknown-options-as-args`. yargs si
   * proto `--dry-run` i `--force` sebere jako své vlastní volby a do skriptu
   * pošle prázdné pole. Syrová příkazová řádka je tím pádem jediné místo,
   * kde ty přepínače spolehlivě jsou.
   */
  const prepinace = [...(args ?? []), ...process.argv.slice(2)]
  const zapnuto = (prepinac: string, promenna: string) =>
    prepinace.includes(prepinac) || Boolean(process.env[promenna])

  const naSucho = zapnuto("--dry-run", "SHIPPING_PROFILE_DRY_RUN")
  const vynuceno = zapnuto("--force", "SHIPPING_PROFILE_FORCE")
  const vsem = zapnuto("--all", "SHIPPING_PROFILE_ALL")
  const jen = [
    ...prepinace
      .filter((p) => p.startsWith("--only="))
      .flatMap((p) => p.slice("--only=".length).split(",")),
    ...(process.env.SHIPPING_PROFILE_ONLY ?? "").split(","),
  ]
    .map((p) => p.trim())
    .filter(Boolean)

  /*
   * Ani selhání nesmí zastavit vývojový server: `dev` skript volá tenhle
   * soubor přes `&&`, takže nenulový návratový kód by znamenal, že po
   * nedostupné databázi nebo překlepu v datech vůbec nenaběhne Medusa.
   * Doplnění profilu je pomoc, ne podmínka běhu.
   */
  try {
    await doplnitProfily(container, logger, { naSucho, vynuceno, jen, vsem })
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
  {
    naSucho,
    vynuceno,
    jen,
    vsem,
  }: { naSucho: boolean; vynuceno: boolean; jen: string[]; vsem: boolean }
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

  const chybejici: { id: string; title: string }[] = []
  const vsechny: any[] = []
  let prohlednuto = 0

  if (jen.length) {
    /* Vyjmenované kusy. `id` i `handle`, protože z adresy výrobku má člověk
       po ruce handle, kdežto z logu spíš id. */
    const { data: products } = await query.graph({
      entity: "product",
      fields: [...SHIPPING_PROFILE_PRODUCT_FIELDS, "handle"],
      filters: { $or: [{ id: jen }, { handle: jen }] } as any,
    })

    prohlednuto = products.length
    vsechny.push(...(products as any[]))
    chybejici.push(...productsMissingShippingProfile(products as any[]))

    if (!prohlednuto) {
      logger.error(
        `[shipping-profile] Žádný z uvedených produktů neexistuje: ${jen.join(", ")}`
      )
      return
    }
  } else {
    // Po stránkách: katalog má stovky kusů a `query.graph` bez stránkování
    // vrací jen první dávku.
    const STRANKA = 200
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
      vsechny.push(...(products as any[]))
      chybejici.push(...productsMissingShippingProfile(products as any[]))

      if (products.length < STRANKA) {
        break
      }

      skip += STRANKA
    }
  }

  // Rozpis dřív než verdikt: když je příčina jinde, tohle je to, co ji ukáže.
  for (const [nazev, pocet] of shippingProfileSummary(vsechny)) {
    logger.info(`[shipping-profile]   ${nazev}: ${pocet}`)
  }

  /*
   * `--all` bere i kusy, které profil mají, ale jiný než výchozí. Ty se
   * nedají jen „dolinkovat" — starý odkaz je potřeba zrušit, a to umí
   * `updateProductsWorkflow` (dismiss + create v jednom). Bez `--all` se
   * jich nikdo nedotkne: jiný profil může být vědomé rozhodnutí.
   */
  const jinyProfil = vsem
    ? vsechny.filter(
        (product) =>
          product?.shipping_profile?.id &&
          product.shipping_profile.id !== profil.id
      )
    : []

  if (jinyProfil.length) {
    logger.info(
      `[shipping-profile] S jiným profilem: ${jinyProfil.length} — --all je srovná na ${profil.name}.`
    )
  }

  if (!chybejici.length && !jinyProfil.length) {
    logger.info(
      `[shipping-profile] Prohlédnuto ${prohlednuto} produktů, profil mají všechny správně. Není co doplňovat.`
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

  if (chybejici.length) {
    await assignShippingProfile(
      container,
      chybejici.map((p) => p.id),
      profil.id
    )
  }

  if (jinyProfil.length) {
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: jinyProfil.map((product) => product.id) },
        update: { shipping_profile_id: profil.id },
      },
    })
  }

  logger.info(
    `[shipping-profile] Doplněno u ${chybejici.length} produktů, přepsáno u ${jinyProfil.length}. Objednávky s nimi teď půjdou dokončit.`
  )
}
