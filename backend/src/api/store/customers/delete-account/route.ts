import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = req.auth_context?.actor_id;

  if (!customerId) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  const customerModuleService = req.scope.resolve(Modules.CUSTOMER);

  try {
    await customerModuleService.softDeleteCustomers([customerId]);
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: "Failed to soft delete customer.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Customer soft deleted.",
  });
};
