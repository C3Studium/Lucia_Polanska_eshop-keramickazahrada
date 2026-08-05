import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { sendCustomerEmail } from "../../../../lib/customer-email";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = req.auth_context?.actor_id;

  if (!customerId) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  const customerModuleService = req.scope.resolve(Modules.CUSTOMER);

  // Read before the soft delete — afterwards the row no longer lists.
  let customer: { email?: string; first_name?: string | null } | null = null;
  try {
    customer = await customerModuleService.retrieveCustomer(customerId);
  } catch {
    customer = null;
  }

  try {
    await customerModuleService.softDeleteCustomers([customerId]);
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: "Failed to soft delete customer.",
    });
  }

  // The farewell mail. Soft delete is restorable (restore-account route), which
  // is exactly what the template's copy promises. Keyed per customer and day:
  // delete → restore → delete again on a later day sends again, a double click
  // today does not. Best-effort — a mail problem must not fail the deletion.
  if (customer?.email) {
    try {
      await sendCustomerEmail(req.scope, {
        template: "account-deleted",
        to: customer.email,
        key: `account-deleted:${customerId}:${new Date().toISOString().slice(0, 10)}`,
        data: {
          customerName: customer.first_name || "",
          email: customer.email,
          deletionDate: new Date().toLocaleDateString("cs-CZ"),
        },
      });
    } catch {
      // Logged by sendCustomerEmail's own path; deletion already succeeded.
    }
  }

  return res.status(200).json({
    success: true,
    message: "Customer soft deleted.",
  });
};
