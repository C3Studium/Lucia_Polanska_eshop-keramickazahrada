const c = require("ansi-colors")

/*
 * Co musí být nastavené, než se obchod vůbec postaví.
 *
 * Rozšířeno 8. 11. 2026 po dvou výpadcích v jednom dni. Oba byly v proměnné,
 * oba se projevily až na produkci a ani jeden neřekl, co mu chybí:
 *
 * 1. MEDUSA_BACKEND_URL ukazovala na doménu, která po přesunu zmizela — každá
 *    stránka obchodu vracela 500, protože načtení regionů vyhodilo.
 * 2. Pak se opravila na adresu BEZ protokolu. Build spadl na Failed to parse
 *    URL a administrace v prohlížeči na Failed to construct URL.
 *
 * Obojí je tady chycené dřív, než se to nasadí.
 */
const requiredEnvs = [
  {
    key: "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
    description:
      "Learn how to create a publishable key: https://docs.medusajs.com/resources/storefront-development/publishable-api-keys",
  },
]

/** Jedna z dvojice stačí — obchod si vybere MEDUSA_BACKEND_URL napřed. */
const ADRESA_BACKENDU = ["MEDUSA_BACKEND_URL", "NEXT_PUBLIC_MEDUSA_BACKEND_URL"]

/**
 * Nepovinné, ale jejich absence se projeví až tím, že něco tiše nefunguje.
 * Build nezastaví — jen o sobě dá hlasitě vědět.
 */
const doporuceneEnvs = [
  {
    key: "REVALIDATE_SECRET",
    description:
      "Bez nej obchod odmitne obnovu katalogu (503) a ukazuje stara data, i kdyz se v administraci zmeni cena, nazev nebo fotka. Musi byt STEJNE jako na backendu.",
  },
  {
    key: "NEXT_PUBLIC_BASE_URL",
    description:
      "Vlastni adresa obchodu. Bez ni miri odkazy v e-mailech a v sitemape jinam, nez kde web stoji.",
  },
]

function checkEnvVariables() {
  const missingEnvs = requiredEnvs.filter(function (env) {
    return !process.env[env.key]
  })

  const adresa = ADRESA_BACKENDU.map(function (key) {
    return process.env[key]
  }).find(Boolean)

  if (!adresa) {
    missingEnvs.push({
      key: ADRESA_BACKENDU.join(" nebo "),
      description:
        "Adresa backendu i s protokolem, napr. https://admin.keramickazahrada.cz. Bez ni obchod nema odkud cist data.",
    })
  }

  if (missingEnvs.length > 0) {
    console.error(
      c.red.bold("\n🚫 Error: Missing required environment variables\n")
    )

    missingEnvs.forEach(function (env) {
      console.error(c.yellow(`  ${c.bold(env.key)}`))
      if (env.description) {
        console.error(c.dim(`    ${env.description}\n`))
      }
    })

    console.error(
      c.yellow(
        "\nPlease set these variables in your .env file or environment before starting the application.\n"
      )
    )

    process.exit(1)
  }

  /*
   * Protokol, ne jen adresa. new URL("admin.keramickazahrada.cz") vyhodí —
   * a vyhodí to až v běžícím prohlížeči nebo uprostřed buildu, kde se to
   * hledá hůř než tady.
   */
  if (adresa && !/^https?:\/\//i.test(adresa)) {
    console.error(c.red.bold("\n🚫 Error: adresa backendu je bez protokolu\n"))
    console.error(c.yellow(`  ${c.bold(ADRESA_BACKENDU[0])} = ${adresa}`))
    console.error(
      c.dim(
        "    Musi zacinat https:// (nebo http:// ve vyvoji). Bez protokolu z ni\n" +
          "    nevznikne platna adresa a build spadne na Failed to parse URL.\n"
      )
    )
    process.exit(1)
  }

  const chybiDoporucene = doporuceneEnvs.filter(function (env) {
    return !process.env[env.key]
  })

  if (chybiDoporucene.length > 0) {
    console.warn(
      c.yellow.bold("\n⚠️  Chybi promenne, bez kterych neco tise nefunguje\n")
    )
    chybiDoporucene.forEach(function (env) {
      console.warn(c.yellow(`  ${c.bold(env.key)}`))
      console.warn(c.dim(`    ${env.description}\n`))
    })
  }
}

module.exports = checkEnvVariables
