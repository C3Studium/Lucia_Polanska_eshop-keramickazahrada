import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import jwt from "jsonwebtoken"
import { pripojitObjednavkyHosta } from "./pripojit-objednavky-hosta"

/**
 * Nastavení hesla z odkazu v e-mailu = ověřený e-mail (14. 11. 2026).
 *
 * Zákazník, který nakupoval bez účtu, si přes „Zapomenuté heslo" nastaví
 * heslo — a po přihlášení ho účet poslal pro DALŠÍ e-mail „Ověřte adresu".
 * Ověřit nebylo co: odkaz na nové heslo přišel právě do té schránky. Po
 * úspěšném nastavení hesla se proto účet rovnou označí jako ověřený.
 *
 * Token čteme sami a ověřujeme podpisem (týž `jwtSecret`, kterým ho Medusa
 * podepsala) — z hlavičky by jinak šlo podstrčit cizí e-mail.
 */
export const emailZTokenuObnovy = (
  token: string | undefined | null,
  secret: string
): string | null => {
  if (!token) return null
  try {
    const obsah = jwt.verify(token, secret) as Record<string, unknown>
    if (obsah?.actor_type && obsah.actor_type !== "customer") return null
    const email = typeof obsah?.entity_id === "string" ? obsah.entity_id : null
    return email && email.includes("@") ? email.toLowerCase() : null
  } catch {
    return null
  }
}

type ZakazniciSluzba = {
  listCustomers: (filtr: Record<string, unknown>) => Promise<any[]>
  updateCustomers: (id: string, data: Record<string, unknown>) => Promise<unknown>
}

export const overitEmailPoObnove = async (email: string, customers: ZakazniciSluzba) => {
  /* Bez `has_account`: host, kterému obnova hesla přihlášení teprve založila
     (lib/guest-password-reset), zůstává záznamem s has_account false — a právě
     on je typický případ. */
  const ucty = await customers.listCustomers({ email })
  for (const ucet of ucty) {
    if (ucet?.metadata?.email_verified === true) continue
    await customers.updateCustomers(ucet.id, {
      metadata: {
        ...(ucet.metadata ?? {}),
        email_verified: true,
        email_verification_token: null,
        email_verification_expires_at: null,
      },
    })
  }
}

/** Před Medusinou routou `/auth/customer/emailpass/update`; ověří až po úspěchu. */
export function overitEmailPoObnoveMiddleware() {
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const hlavicka = String(req.headers.authorization ?? "")
    const token =
      (hlavicka.toLowerCase().startsWith("bearer ") ? hlavicka.slice(7).trim() : "") ||
      (typeof req.query?.token === "string" ? req.query.token : "")
    const { http } = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
    const email = emailZTokenuObnovy(token, String(http.jwtSecret ?? ""))
    if (email) {
      res.on("finish", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return
        const zakaznici = req.scope.resolve(Modules.CUSTOMER) as any
        overitEmailPoObnove(email, zakaznici)
          /* Prokázaný e-mail = dřívější nákupy bez účtu patří k účtu (14. 11.). */
          .then(async () => {
            const ucty = await zakaznici.listCustomers({ email, has_account: true })
            for (const ucet of ucty) {
              await pripojitObjednavkyHosta(ucet.id, email, {
                customers: zakaznici,
                orders: req.scope.resolve(Modules.ORDER) as any,
              })
            }
          })
          .catch((chyba) => {
          req.scope
            .resolve(ContainerRegistrationKeys.LOGGER)
            .warn(`[obnova hesla] E-mail se nepodařilo označit jako ověřený: ${(chyba as Error)?.message ?? chyba}`)
        })
      })
    }
    next()
  }
}
