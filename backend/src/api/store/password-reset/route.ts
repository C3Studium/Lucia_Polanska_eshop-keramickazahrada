import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { generateResetPasswordTokenWorkflow } from "@medusajs/core-flows"
import { stavAdresy } from "../../../lib/guest-password-reset"

/**
 * Žádost o obnovu hesla s poctivou odpovědí (13. 11. 2026).
 *
 * Vestavěná `/auth/customer/emailpass/reset-password` odpovídá vždy stejně,
 * takže formulář tvrdil „poslali jsme e-mail" i adrese, která u obchodu účet
 * nemá. Matěj chce pravdu: neznámá adresa se dozví, že účet nemá, a může si ho
 * založit.
 *
 * Cena: z odpovědi jde poznat, jestli adresa u obchodu má účet. Proto stojí
 * za stejným omezovačem jako vestavěná obnova (3 žádosti za 15 min a 10 za den
 * na adresu, viz `lib/reset-password-throttle.ts` a `middlewares.ts`) a ve
 * storefrontu navíc za stropem podle IP.
 *
 * - účet s heslem → odkaz se pošle (`sent`)
 * - host, který nakupoval bez účtu → `guest`: ať si založí účet se stejným
 *   e-mailem, objednávky se připojí po potvrzení e-mailu (14. 11. 2026,
 *   lib/pripojit-objednavky-hosta.ts); žádný e-mail
 * - nikdo → `no-account`, žádný e-mail
 */
const TVAR_EMAILU = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const identifier = (req.body as { identifier?: unknown } | undefined)?.identifier
  const email = typeof identifier === "string" ? identifier.trim().toLowerCase() : ""
  if (!email || email.length > 254 || !TVAR_EMAILU.test(email)) {
    res.status(400).json({ message: "Zadejte prosím platnou e-mailovou adresu." })
    return
  }

  const stav = await stavAdresy(email, {
    auth: req.scope.resolve(Modules.AUTH) as never,
    customers: req.scope.resolve(Modules.CUSTOMER) as never,
  })
  if (stav === "nikdo") {
    res.json({ status: "no-account" })
    return
  }
  if (stav === "host") {
    res.json({ status: "guest" })
    return
  }

  const { http } = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
  await generateResetPasswordTokenWorkflow(req.scope).run({
    input: {
      entityId: email,
      actorType: "customer",
      provider: "emailpass",
      secret: http.jwtSecret as string,
      jwtOptions: http.jwtOptions,
    },
  })
  res.json({ status: "sent" })
}
