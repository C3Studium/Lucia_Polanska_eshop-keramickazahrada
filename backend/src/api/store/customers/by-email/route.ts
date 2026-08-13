import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * Does a *registered* account exist for this address? — the one question
 * signup needs answered.
 *
 * This used to return the whole first customer record for any e-mail to any
 * unauthenticated caller — name, phone, metadata including the live
 * verification token. That is an enumeration-and-leak hole, and the "first
 * record" part is the guest-record bug described in
 * resend-verification-email. Guests are deliberately invisible here: a guest
 * purchase must not block registration (the guest keeps its order history;
 * the admin groups people by e-mail).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const email = req.query.email as string
  if (!email) {
    res.status(400).json({ error: "Email is required" })
    return
  }

  const customerModuleService = req.scope.resolve(Modules.CUSTOMER)
  const customers = await customerModuleService.listCustomers({
    email,
    has_account: true,
  })

  res.json({ registered: customers.length > 0 })
}
