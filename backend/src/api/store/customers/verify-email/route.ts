import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { sendCustomerEmail } from "../../../../lib/customer-email"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { token, email } = req.body as { token: string; email: string }

  console.log("[VERIFY EMAIL] Incoming request:", { token, email })

  if (!token || !email) {
    console.log("[VERIFY EMAIL] Missing token or email.")
    res.status(400).json({ message: "Missing token or email." })
    return
  }

  const customerModuleService = req.scope.resolve(Modules.CUSTOMER)
  let customer = null as any
  try {
    const customers = await customerModuleService.listCustomers({ email })
    customer = customers[0] || null
    console.log("[VERIFY EMAIL] Retrieved customer:", customer)
  } catch (err) {
    console.log("[VERIFY EMAIL] Error retrieving customer:", err)
    customer = null
  }

  if (!customer || !customer.metadata?.email_verification_token) {
    console.log("[VERIFY EMAIL] No customer or missing verification token.", {
      customer,
    })
    res.status(404).json({ message: "Invalid token or email." })
    return
  }

  const tokenMatches = customer.metadata.email_verification_token === token
  const expiresAt = customer.metadata.email_verification_expires_at
  const isExpired = expiresAt && new Date(expiresAt) < new Date()

  console.log("[VERIFY EMAIL] Token matches:", tokenMatches)
  console.log("[VERIFY EMAIL] Token expires at:", expiresAt, "Is expired:", isExpired)

  if (!tokenMatches || isExpired) {
    console.log("[VERIFY EMAIL] Invalid or expired token.", {
      tokenMatches,
      isExpired,
      customerToken: customer.metadata.email_verification_token,
      providedToken: token,
      expiresAt,
    })
    res.status(400).json({ message: "Invalid or expired token." })
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
    console.log("[VERIFY EMAIL] Email verified and customer updated:", customer.id)
  } catch (err) {
    console.log("[VERIFY EMAIL] Error updating customer:", err)
    res.status(500).json({ message: "Failed to update customer." })
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
    console.log("[VERIFY EMAIL] Failed to queue the welcome e-mail:", err)
  }

  // retrieve updated customer to return to client
  let updatedCustomer = null
  try {
    updatedCustomer = await customerModuleService.retrieveCustomer(customer.id)
    console.log("[VERIFY EMAIL] Updated customer:", updatedCustomer)
  } catch (err) {
    console.log("[VERIFY EMAIL] Error retrieving updated customer:", err)
  }

  res.status(200).json({ ok: true, message: "Email verified successfully.", customer: updatedCustomer })
  }