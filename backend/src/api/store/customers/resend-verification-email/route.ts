import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { v4 as uuidv4 } from "uuid"
import { Modules } from "@medusajs/framework/utils"
import { verifyEmailLink } from "../../../../lib/storefront-url"

/**
 * Resend the e-mail verification link.
 *
 * The lookup filters on `has_account: true` — this is the fix for the bug
 * Matěj reported (2026-08-13): guest checkout mints a customer record per
 * anonymous order, so `listCustomers({ email })[0]` for a buyer-then-registrar
 * returned a GUEST record. The fresh token was then written to that guest and
 * the emailed link verified it, while the actual account's
 * `metadata.email_verified` stayed false — the storefront kept saying
 * „zkontrolujte poštu" forever. The token lives on the registered record and
 * nowhere else.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { email } = (req.body ?? {}) as { email?: string }

    if (!email) {
      res.status(400).json({ message: "Chybí e-mailová adresa." })
      return
    }

    const customerModuleService = req.scope.resolve(Modules.CUSTOMER)
    const notificationModuleService = req.scope.resolve(Modules.NOTIFICATION)

    const customers = await customerModuleService.listCustomers({
      email,
      has_account: true,
    })
    const customer = customers[0] || null

    if (!customer) {
      res
        .status(404)
        .json({ message: "K tomuto e-mailu nepatří žádný registrovaný účet." })
      return
    }

    if (customer.metadata?.email_verified === true) {
      res.status(200).json({ message: "E-mail už je ověřený — stačí se přihlásit." })
      return
    }

    // Reuse a still-valid token (the earlier mail keeps working); rotate an
    // expired or missing one.
    let token = customer.metadata?.email_verification_token as
      | string
      | undefined
    const expiresAtRaw = customer.metadata?.email_verification_expires_at as
      | string
      | undefined

    const expired =
      !token || !expiresAtRaw || new Date(expiresAtRaw).getTime() < Date.now()

    if (expired) {
      token = uuidv4()
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()

      await customerModuleService.updateCustomers(customer.id, {
        metadata: {
          ...customer.metadata,
          email_verification_token: token,
          email_verification_expires_at: expiresAt,
          email_verified: false,
        },
      })
    }

    const verificationUrl = verifyEmailLink(token, email)
    if (!verificationUrl) {
      console.error(
        "[resend-verification] STOREFRONT_PUBLIC_URL/MEDUSA_STOREFRONT_URL not set — cannot build the verification link."
      )
      res.status(500).json({
        message: "Odkaz teď neumíme sestavit. Napište nám prosím.",
      })
      return
    }

    await notificationModuleService.createNotifications({
      to: email,
      channel: "email",
      template: "email-verification",
      data: {
        verification_url: verificationUrl,
        email,
      },
    })

    res.status(200).json({ message: "Ověřovací e-mail je na cestě." })
  } catch (err) {
    console.error("Error in resend-verification-email route:", err)
    res.status(500).json({
      message:
        "Ověřovací e-mail se nepodařilo odeslat. Zkuste to prosím za chvíli.",
    })
  }
}
