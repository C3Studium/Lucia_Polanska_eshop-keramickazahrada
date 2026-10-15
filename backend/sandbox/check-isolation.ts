/**
 * Důkaz izolace sandboxu: co se se sandboxovým prostředím zaregistrovalo.
 *
 *   node sandbox/backend.mjs check
 *
 * Vypisuje jen jména poskytovatelů a JMÉNA neprázdných citlivých proměnných,
 * nikdy hodnoty. Běží přes `medusa exec` se stejným medusa-config.js a stejným
 * prostředím jako sandbox server, takže registrace je totožná.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const SENSITIVE = [
  "DATABASE_URL", "REDIS_URL", "R2_", "MINIO_", "RESEND_", "IDOKLAD_", "COMGATE_", "SEGMENT_",
  "STRIPE_", "SENDGRID_", "BALIKOVNA_", "PACKETA_", "ALGOLIA_", "MEILISEARCH_", "SANITY_",
  "IMPORT_ADMIN_", "GOOGLE_", "CMS_", "SUPABASE_", "OWNER_NOTIFICATION", "DEV_NOTIFICATION",
  "BACKEND_PUBLIC_URL", "STOREFRONT_PUBLIC_URL",
]

function hostOf(v: string | undefined) {
  if (!v) return null
  try {
    const u = new URL(v)
    return `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}`
  } catch {
    return "(není URL)"
  }
}

export default async function checkIsolation({ container }: ExecArgs) {
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  const modules: Record<string, unknown> = {}
  for (const [key, def] of Object.entries<any>(config.modules ?? {})) {
    if (!def || typeof def !== "object") {
      modules[key] = def
      continue
    }
    const providers = Array.isArray(def?.options?.providers)
      ? def.options.providers.map((p: any) => `${p.id} ← ${p.resolve}`)
      : undefined
    modules[key] = providers ? { resolve: def.resolve, providers } : def.resolve ?? true
  }

  const payment = container.resolve(Modules.PAYMENT) as any
  const fulfillment = container.resolve(Modules.FULFILLMENT) as any
  const paymentProviders = (await payment.listPaymentProviders({})).map((p: any) => `${p.id}${p.is_enabled ? "" : " (vypnutý)"}`)
  const fulfillmentProviders = (await fulfillment.listFulfillmentProviders({})).map((p: any) => `${p.id}${p.is_enabled ? "" : " (vypnutý)"}`)
  const notificationProviders = (
    await pg.raw("select id, handle, channels, is_enabled from notification_provider order by id")
  ).rows.map((r: any) => `${r.id} [${r.channels}]${r.is_enabled ? "" : " (vypnutý)"}`)

  const fileProviders = (config.modules?.[Modules.FILE]?.options?.providers ?? []).map((p: any) => ({
    id: p.id,
    resolve: p.resolve,
    backend_url: p.options?.backend_url ?? null,
  }))

  const nonEmptySensitive = Object.keys(process.env)
    .filter((k) => process.env[k] && SENSITIVE.some((s) => k.startsWith(s)))
    .sort()

  const report = {
    database_host: hostOf(process.env.DATABASE_URL),
    redis: process.env.REDIS_URL ? "NASTAVENO (!)" : "žádný (fake redis, lokální event bus, in-memory workflow engine)",
    resend_base_url: hostOf(process.env.RESEND_BASE_URL),
    file_providers: fileProviders,
    payment_providers: paymentProviders,
    fulfillment_providers: fulfillmentProviders,
    notification_providers: notificationProviders,
    idoklad_module_registered: Boolean((config.modules as any)?.idoklad || Object.values<any>(config.modules ?? {}).some((m) => String(m?.resolve ?? "").includes("idoklad"))),
    redis_modules: Object.entries<any>(config.modules ?? {})
      .filter(([, m]) => String(m?.resolve ?? "").includes("redis"))
      .map(([k]) => k),
    non_empty_sensitive_env_names: nonEmptySensitive,
    modules,
  }

  // eslint-disable-next-line no-console
  console.log("\n===== SANDBOX ISOLATION =====\n" + JSON.stringify(report, null, 2) + "\n=============================\n")
}
