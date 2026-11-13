import { randomBytes } from "node:crypto"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Obnova hesla pro hosta (13. 11. 2026).
 *
 * Kdo nakupoval bez účtu, má v Meduse jen záznam zákazníka (`has_account:
 * false`) a žádné přihlášení. „Zapomněli jste heslo?" mu proto neposlalo nic
 * — Medusa pro adresu bez přihlášení tiše skončí a formulář schválně odpovídá
 * stejně jako u účtu (nesmí prozradit, kdo u obchodu nakupuje). Naměřeno na
 * produkci: 15 zákazníků, jen 3 přihlášení — e-mail nedostal skoro nikdo.
 *
 * Řešení: těsně před vestavěnou obnovou se hostovi založí přihlášení
 * s náhodným heslem, navázané na jeho existující záznam (`customer_id`).
 * Medusa pak pošle běžný odkaz na nastavení hesla — a kdo ho otevře, dokázal,
 * že schránka je jeho. Po nastavení hesla je přihlášený jako ten samý
 * zákazník, i s dřívějšími objednávkami.
 *
 * Neznámá adresa dál nedostane nic a odpověď navenek je pořád stejná.
 */

type Sluzby = {
  auth: {
    listProviderIdentities: (filter: Record<string, unknown>) => Promise<unknown[]>
    register: (
      provider: string,
      data: { body: Record<string, unknown> }
    ) => Promise<{ success?: boolean; authIdentity?: { id: string }; error?: string }>
    updateAuthIdentities: (data: { id: string; app_metadata: Record<string, unknown> }) => Promise<unknown>
  }
  customers: {
    listCustomers: (filter: Record<string, unknown>) => Promise<Array<{ id: string; has_account?: boolean | null }>>
  }
}

export type VysledekHosta = "existuje" | "zalozeno" | "neni-zakaznik"

export const zalozPrihlaseniProHosta = async (
  email: string,
  { auth, customers }: Sluzby
): Promise<VysledekHosta> => {
  const adresa = email.trim().toLowerCase()

  const prihlaseni = await auth.listProviderIdentities({
    provider: "emailpass",
    entity_id: adresa,
  })
  if (prihlaseni.length) return "existuje"

  const host = (await customers.listCustomers({ email: adresa })).find(
    (zakaznik) => !zakaznik.has_account
  )
  if (!host) return "neni-zakaznik"

  const { success, authIdentity, error } = await auth.register("emailpass", {
    /* Heslo nikdo nezná — přihlásit se jde až po nastavení přes odkaz. */
    body: { email: adresa, password: randomBytes(32).toString("base64url") },
  })
  if (!success || !authIdentity) {
    throw new Error(`přihlášení pro hosta se nepodařilo založit: ${error ?? "?"}`)
  }

  await auth.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { customer_id: host.id },
  })
  return "zalozeno"
}

/** Middleware před `/auth/customer/emailpass/reset-password`. Chyba nikdy nezastaví obnovu. */
export function zalozPrihlaseniProHostaMiddleware() {
  return async (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    const identifier = (req.body as { identifier?: unknown } | undefined)?.identifier
    if (typeof identifier !== "string" || !identifier.includes("@")) return next()

    try {
      const vysledek = await zalozPrihlaseniProHosta(identifier, {
        auth: req.scope.resolve(Modules.AUTH) as unknown as Sluzby["auth"],
        customers: req.scope.resolve(Modules.CUSTOMER) as unknown as Sluzby["customers"],
      })
      if (vysledek === "zalozeno") {
        req.scope
          .resolve(ContainerRegistrationKeys.LOGGER)
          .info("[obnova hesla] host dostal přihlášení — posílá se odkaz na nastavení hesla")
      }
    } catch (error) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error(`[obnova hesla] ${(error as Error).message}`)
    }
    return next()
  }
}
