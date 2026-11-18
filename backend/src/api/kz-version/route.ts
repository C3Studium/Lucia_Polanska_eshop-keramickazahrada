import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Která verze backendu (a tím i adminu) právě běží — z Railway
 * (18. 11. 2026). Otevřený admin to porovná s commitem, se kterým byl
 * sestaven (`window.__KZ_ADMIN_COMMIT` v index.html, medusa-config), a po
 * novém nasazení se sám obnoví (s uložením rozepsaných polí).
 *
 * Veřejné a levné: jen proměnné prostředí, žádná data obchodu.
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "no-store")
  res.status(200).json({
    commit: (process.env.RAILWAY_GIT_COMMIT_SHA || "").slice(0, 12) || null,
    deployment: process.env.RAILWAY_DEPLOYMENT_ID || null,
  })
}

// Zkušební nasazení 18. 11. 2026 — ověření lišty „Byla spuštěna nová verze".
