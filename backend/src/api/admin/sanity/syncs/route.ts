import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import { sanitySyncProductsWorkflow } from "../../../../workflows/sanity-sync-products";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { transaction } = await sanitySyncProductsWorkflow(req.scope).run({
    input: {},
  });

  res.json({ transaction_id: transaction.transactionId });
};

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const workflowEngine = req.scope.resolve(
    Modules.WORKFLOW_ENGINE,
  );

  const [executions, count] = await workflowEngine.listAndCountWorkflowExecutions(
    {
      workflow_id: sanitySyncProductsWorkflow.getName(),
    },
    { order: { created_at: "DESC" } },
  );

  res.json({
    workflow_executions: executions,
    count,
    // The Studio lives on the storefront; the admin bundle cannot know where
    // that is, so the server says (a hardcoded localhost was a broken link).
    studio_url: process.env.SANITY_STUDIO_URL || null,
  });
};
