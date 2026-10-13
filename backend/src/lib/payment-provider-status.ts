import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Zeptá se platební brány, co se stalo s relací.
 *
 * Poskytovatelé (`pp_comgate_comgate` …) jsou zaregistrovaní v kontejneru
 * **platebního modulu**, ne v kontejneru aplikace. `container.resolve("pp_…")`
 * z jobu proto pokaždé padal na „Could not resolve 'pp_comgate_comgate'" —
 * změřeno v logu produkce 13. 10. 2026: dohled nad platbami z pokladny ani
 * nad doplatky tak nikdy nic neověřil. Modul je drží ve své
 * `paymentProviderService_` a veřejnou metodu na stav Medusa 2.18 nemá.
 */
export const paymentStatusFromProvider = async (
  container: MedusaContainer,
  session: { provider_id?: string | null; data?: Record<string, unknown> | null }
): Promise<{ status?: string; data?: Record<string, unknown> }> => {
  const providerId = `pp_${String(session.provider_id ?? "")}`.replace(
    /^pp_pp_/,
    "pp_"
  )
  const providers = (container.resolve(Modules.PAYMENT) as any)
    ?.paymentProviderService_

  if (typeof providers?.getStatus !== "function") {
    throw new Error(
      "Platební modul nevystavuje své poskytovatele — změnila se Medusa?"
    )
  }

  return providers.getStatus(providerId, { data: session.data ?? {} })
}
