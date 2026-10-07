import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { balikovnaShippingAddress } from "../lib/balikovna-shipping-address"

/**
 * U Balíkovny je doručovací adresa VÝDEJNA, ne domácí adresa zákazníka.
 *
 * ## Co se dělo
 *
 * Při výběru Balíkovny zapíše pokladna výdejnu jen do `cart.metadata`
 * (`balikovna_point_*`) a `shipping_address` nechá na kontaktní/účtové adrese
 * zákazníka (tu zadává v kroku adresy, který běží PŘED volbou dopravy). Nativní
 * karta „Doručovací adresa" v adminu, tisk balicího listu i rekapitulace pak
 * ukazují adresu zákazníka domů — i když zásilka míří na výdejnu. Majitelka to
 * právem označila za matoucí: u Balíkovny má být doručovací adresa ten point,
 * domácí adresa platí jako doručovací jen u České pošty domů.
 *
 * ## Co s tím
 *
 * Po vzniku objednávky přepíšeme `shipping_address` tak, aby ODRÁŽELA VÝDEJNU
 * (adresní pole = Balíkovna + název/PSČ výdejny), ale ZACHOVÁME jméno a telefon
 * příjemce — ty ČP štítek potřebuje jako kontakt na adresáta (štítek bere
 * výdejnu z metadat, ne z adresy, takže se tím neláme; `company` ZÁMĚRNĚ
 * nenastavujeme, jinak by ČP vzala firmu místo jména). Domácí adresu uchováme
 * jako `billing_address` (fakturu idoklad staví z `billing ?? shipping`), takže
 * faktura dál jde na zákazníka, ne na výdejnu.
 *
 * ## Proč to nic nerozbije, i kdyby to spadlo
 *
 * Fail-open: jakákoli chyba se jen zaloguje a objednávka jede dál — přepis
 * adresy nesmí být důvod, proč by objednávka neprošla. Idempotentní přes
 * `metadata.pickup_address_applied`. E-mail „objednávka přijata" na tohle
 * NEČEKÁ — čte výdejnu z metadat sám (žádný závod subscriberů).
 */

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

export default async function applyPickupShippingAddress({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const orderId = data?.id
    if (!orderId) return

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "metadata",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.name",
      ],
      filters: { id: orderId },
    })
    const order = orders[0] as any
    if (!order) return

    const metadata = (order.metadata ?? {}) as Record<string, any>
    if (metadata.pickup_address_applied) return

    const zip = metadata.balikovna_point_zip
    const name = metadata.balikovna_point_name
    if (typeof zip !== "string" || !zip || typeof name !== "string" || !name) {
      return
    }

    // Jen když je zvolená doprava opravdu Balíkovna (metadata mohou zůstat
    // zastaralá, kdyby zákazník přepnul na jinou dopravu).
    const isBalikovna = ((order.shipping_methods ?? []) as any[]).some((method) =>
      fold(String(method?.name ?? "")).includes("balikovna")
    )
    if (!isBalikovna) return

    const home = (order.shipping_address ?? {}) as Record<string, any>
    const pointAddress =
      typeof metadata.balikovna_point_address === "string"
        ? metadata.balikovna_point_address
        : ""
    const country = home.country_code || "cz"

    const update: Record<string, any> = {
      id: orderId,
      // Výdejna jako doručovací adresa; jméno + telefon zůstávají (příjemce na
      // štítku). Sdílené s endpointem pro změnu výdejny v úpravě objednávky.
      shipping_address: balikovnaShippingAddress(
        { zip, name, address: pointAddress },
        {
          first_name: home.first_name,
          last_name: home.last_name,
          phone: home.phone,
          country_code: country,
        }
      ),
      metadata: { ...metadata, pickup_address_applied: true },
    }

    // Domácí adresa přežívá jako fakturační (pro fakturu), když žádná není.
    if (!order.billing_address) {
      update.billing_address = {
        first_name: home.first_name ?? "",
        last_name: home.last_name ?? "",
        phone: home.phone ?? "",
        company: home.company ?? "",
        address_1: home.address_1 ?? "",
        address_2: home.address_2 ?? "",
        city: home.city ?? "",
        postal_code: home.postal_code ?? "",
        country_code: country,
      }
    }

    const orderModule = container.resolve(Modules.ORDER) as any
    await orderModule.updateOrders([update])

    logger.info(
      `[pickup-adresa] Objednávka ${orderId}: doručovací adresa nastavena na výdejnu Balíkovny „${name}" (PSČ ${zip}); domácí adresa drží jako fakturační.`
    )
  } catch (error) {
    logger.warn(
      `[pickup-adresa] Adresu výdejny se nepodařilo nastavit, objednávka jede dál: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
