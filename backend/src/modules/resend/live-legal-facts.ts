import type { LiveLegalFacts } from "../../lib/legal"

/**
 * Právní údaje z nastavení obchodu pro patičku e-mailů (identita prodávající,
 * kontakt) — čte je Resend provider těsně před vykreslením.
 *
 * ## Proč přes kořenový kontejner
 *
 * Provider žije v kontejneru notifikačního modulu a modul obchodu (kde jsou
 * nastavení) v něm není — stejná past jako ComGate v opačném směru (84411b5).
 * Kořenový `container` z `@medusajs/framework` je ten, do kterého
 * MedusaAppLoader registruje všechny moduly a který dostávají subscribery
 * a joby, takže v běžícím backendu modul obchodu zná.
 *
 * Framework i nastavení se načítají LÍNĚ, až při prvním e-mailu: v běžícím
 * backendu jsou dávno v paměti, ale unit test provideru by jinak kvůli jedné
 * patičce načítal celý framework (desítky sekund).
 *
 * ## Nikdy nevyhodí a nečeká věčně
 *
 * `null` = údaje teď nejdou přečíst (nastavení, databáze, nenačtená aplikace,
 * pomalá odpověď) — e-mail pak odejde s identitou z manifestu právních
 * dokumentů. E-mail nesmí neodejít kvůli patičce.
 */

/** Jak dlouho nejvýš čekat na nastavení, než e-mail odejde se zálohou. */
const LEGAL_FACTS_TIMEOUT_MS = 3000

export const loadEmailLegalFacts = async (): Promise<LiveLegalFacts | null> => {
  let timer: NodeJS.Timeout | undefined
  try {
    // `require`, ne `import`: líně, viz výše (backend je CommonJS).
    const { container } = require("@medusajs/framework") as typeof import("@medusajs/framework")
    const { getLegalFacts } = require("../../lib/merchant-settings") as typeof import("../../lib/merchant-settings")

    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), LEGAL_FACTS_TIMEOUT_MS)
    })
    const snapshot = await Promise.race([getLegalFacts(container), timeout])
    // `defaults` = nastavení nejde přečíst; manifest je pro ten případ lepší
    // záloha než výchozí hodnoty kódu (generuje ho legal:build z vydaných znění).
    return snapshot && snapshot.source === "settings" ? snapshot.facts : null
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}
