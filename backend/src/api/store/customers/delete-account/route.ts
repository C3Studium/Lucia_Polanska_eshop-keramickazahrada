import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { sendCustomerEmail } from "../../../../lib/customer-email";
import { customerLocaleOf } from "../../../../lib/customer-locale";
import { formatEmailDate } from "../../../../lib/email-locale";

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
  let customer: {
    email?: string;
    first_name?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null = null;
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
        // Jazyk z registrace (customer.metadata.locale), jinak česky.
        locale: customerLocaleOf(customer),
        data: {
          customerName: customer.first_name || "",
          email: customer.email,
          // Česky beze změny („2. 11. 2026"), jinak podle jazyka zákazníka.
          deletionDate: formatEmailDate(new Date(), customerLocaleOf(customer) ?? "cs"),
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
