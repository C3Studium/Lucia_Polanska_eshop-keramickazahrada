import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { sendCustomerEmail } from "../../../../lib/customer-email"

/**
 * Confirms an e-mail verification token.
 *
 * Looks only at registered records (`has_account: true`) and, among them,
 * at the one actually carrying the token — `listCustomers({ email })[0]`
 * used to grab whichever record came first, and after a guest purchase that
 * was the guest: its token never matched the mailed one (or worse, resend had
 * written a token there), so verification either failed outright or marked a
 * record the login never reads. See resend-verification-email for the story.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { token, email } = (req.body ?? {}) as { token?: string; email?: string }

  if (!token || !email) {
    res.status(400).json({ message: "Chybí token nebo e-mail." })
    return
  }

  const customerModuleService = req.scope.resolve(Modules.CUSTOMER)

  let customer: any = null
  try {
    const customers = await customerModuleService.listCustomers({
      email,
      has_account: true,
    })
    customer =
      customers.find(
        (candidate: any) =>
          candidate.metadata?.email_verification_token === token
      ) ??
      customers[0] ??
      null
  } catch (err) {
    console.error("[VERIFY EMAIL] Error retrieving customer:", err)
  }

  if (!customer || !customer.metadata?.email_verification_token) {
    // Already-verified accounts have the token cleared — a second click on the
    // same mail should read as success, not as a scary error.
    if (customer?.metadata?.email_verified === true) {
      res.status(200).json({ ok: true, message: "E-mail už je ověřený." })
      return
    }
    res.status(404).json({ message: "Odkaz neplatí. Nechte si poslat nový." })
    return
  }

  const tokenMatches = customer.metadata.email_verification_token === token
  const expiresAt = customer.metadata.email_verification_expires_at
  const isExpired = expiresAt && new Date(expiresAt) < new Date()

  if (!tokenMatches || isExpired) {
    res
      .status(400)
      .json({ message: "Odkaz už neplatí. Nechte si poslat nový." })
    return
  }

  try {
    // preserve other metadata keys
    await customerModuleService.updateCustomers(customer.id, {
      metadata: {
        ...customer.metadata,
        email_verified: true,
        email_verification_token: null,
        email_verification_expires_at: null,
      },
    })
  } catch (err) {
    console.error("[VERIFY EMAIL] Error updating customer:", err)
    res.status(500).json({ message: "Ověření se nepodařilo uložit." })
    return
  }

  // The welcome mail belongs to the moment the address is proven, not to
  // account creation — creation already sends the verification mail, and two
  // mails in one minute read like a system with a stutter. Keyed per customer,
  // so a re-verification can never send a second welcome. Best-effort: a mail
  // problem must not fail the verification that just succeeded.
  try {
    await sendCustomerEmail(req.scope, {
      template: "welcome",
      to: customer.email,
      key: `welcome:${customer.id}`,
      data: { customerName: customer.first_name || "" },
    })
  } catch (err) {
    console.error("[VERIFY EMAIL] Failed to queue the welcome e-mail:", err)
  }

  let updatedCustomer = null
  try {
    updatedCustomer = await customerModuleService.retrieveCustomer(customer.id)
  } catch (err) {
    console.error("[VERIFY EMAIL] Error retrieving updated customer:", err)
  }

  res.status(200).json({
    ok: true,
    message: "E-mail je ověřený.",
    customer: updatedCustomer,
  })
}
