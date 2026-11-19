import { sdk } from "@lib/config"

import { getAuthHeaders } from "./cookies"

/**
 * Dokumenty objednávky ke stažení (19. 11. 2026) — potvrzení, faktura,
 * dobropisy, obchodní podmínky, poučení o odstoupení, protokol glazury.
 * Totéž, co zákazník dostane e-mailem (backend `lib/order-documents.ts`).
 *
 * Přístup jako u stavu objednávky: přihlášený majitel, nebo host s
 * podepsaným tokenem objednávky. Selhání = `null` → stránka blok nevykreslí.
 */
export type OrderDocument = {
  key: string
  title: string
  note: string | null
  url: string
  filename: string
}

export const getOrderDocuments = async (
  orderId: string,
  token?: string | null
): Promise<OrderDocument[] | null> => {
  const headers = { ...(await getAuthHeaders()) }
  return sdk.client
    .fetch<{ documents: OrderDocument[] }>(`/store/orders/${orderId}/documents`, {
      headers,
      cache: "no-store",
      ...(token ? { query: { token } } : {}),
    })
    .then((response) => response.documents ?? [])
    .catch(() => null)
}
