import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ensureInternationalOrderMethodName } from "../lib/international-shipping"

/**
 * Doprava do zahraničí: objednávka dostane název vybrané (nejlevnější)
 * služby ČP hned po založení — ať ho majitelka vidí v adminu a ve všech
 * e-mailech (lib/international-shipping → ensureInternationalOrderMethodName).
 * Potvrzovací e-mail s PDF a faktura si název srovnají samy ještě před
 * skládáním, na pořadí odběratelů nezáleží.
 */
export default async function internationalShippingNameHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!data?.id) return
  await ensureInternationalOrderMethodName(container, data.id)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
