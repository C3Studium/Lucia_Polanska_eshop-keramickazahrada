import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * The one CMS fact the admin UI needs: where the Studio lives.
 *
 * The admin bundle runs in the browser and cannot read server env — and it
 * must never import `src/lib/constants` to get at it: that file pulls in
 * `@medusajs/framework/utils`, which drags the whole server dependency graph
 * (pg, jsonwebtoken, Node streams) into the vite bundle and crashes the
 * admin at load with `inherits(..., undefined)`. So the env value crosses
 * the wire here instead.
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    studio_url: (process.env.CMS_STUDIO_URL || "").trim().replace(/\/+$/, ""),
  })
}
