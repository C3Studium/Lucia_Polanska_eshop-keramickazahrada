import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { balikovnaShippingAddress } from "../../../../../lib/balikovna-shipping-address"
import { notifyMerchant } from "../../../../../lib/notify"
import { verifyOrderAccessToken } from "../../../../../lib/order-access-link"
import { editabilityMode } from "../../../../../lib/order-edit-gate"

/**
 * Změna DORUČENÍ v úpravě objednávky (přes podepsaný token — i host bez přihlášení).
 *
 * Jiná „metoda" než přepis adresy při objednání (subscriber `pickup-shipping-address`):
 * tady zákazník mění cíl později, dokud objednávka není expedovaná.
 *  - `balikovna`: nová výdejna z widgetu → metadata `balikovna_point_*` + `shipping_address`
 *    odvozená na výdejnu (sdílený helper `balikovnaShippingAddress`).
 *  - `address`: nová adresa z popupu → `shipping_address` (pošta domů).
 *
 * NEMĚNÍ dopravu (Balíkovna ↔ pošta domů) — jen cíl v rámci zvolené dopravy.
 * Gate = stejná brána editovatelnosti jako u položek: dokud není expedice
 * (`editabilityMode !== "none"`). Token odemyká jen přihlášení, zbytek pravidel platí.
 */

type AddressInput = {
  first_name?: string
  last_name?: string
  address_1?: string
  address_2?: string
  city?: string
  postal_code?: string
  country_code?: string
  phone?: string
}

type Body = {
  token?: unknown
  kind?: "address" | "balikovna"
  address?: AddressInput
  point?: { id?: string; zip?: string; name?: string; address?: string }
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Body

  if (!verifyOrderAccessToken(req.params.id, body.token)) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo se nám ozvěte."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "metadata",
      "shipping_address.*",
      "billing_address.*",
      "shipping_methods.name",
      "fulfillments.id",
      "fulfillments.canceled_at",
    ],
    filters: { id: req.params.id },
  })
  const order = orders[0] as any
  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka nebyla nalezena."
    )
  }

  // Dokud není expedice. „none" = fulfillment hotový / terminální stav.
  const { mode, reason } = await editabilityMode(req.scope, order)
  if (mode === "none") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      reason ||
        "Objednávku už nejde upravit — je připravená k odeslání. Ozvěte se nám prosím."
    )
  }

  const isBalikovna = ((order.shipping_methods ?? []) as any[]).some((method) =>
    fold(str(method?.name)).includes("balikovna")
  )

  const home = (order.shipping_address ?? {}) as Record<string, any>
  const metadata = (order.metadata ?? {}) as Record<string, any>
  const orderModule = req.scope.resolve(Modules.ORDER) as any

  let summary: string

  if (body.kind === "balikovna") {
    if (!isBalikovna) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Tahle objednávka nejde na výdejnu Balíkovny."
      )
    }
    const zip = str(body.point?.zip)
    const name = str(body.point?.name)
    if (!zip || !name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Vyberte prosím výdejní místo."
      )
    }
    const pointAddress = str(body.point?.address)

    await orderModule.updateOrders([
      {
        id: order.id,
        shipping_address: balikovnaShippingAddress(
          { zip, name, address: pointAddress },
          {
            first_name: home.first_name,
            last_name: home.last_name,
            phone: home.phone,
            country_code: home.country_code,
          }
        ),
        metadata: {
          ...metadata,
          balikovna_point_id: str(body.point?.id) || metadata.balikovna_point_id || "",
          balikovna_point_zip: zip,
          balikovna_point_name: name,
          balikovna_point_address: pointAddress,
          pickup_address_applied: true,
        },
      },
    ])
    summary = `Nová výdejna Balíkovny: ${name} (PSČ ${zip}).`
  } else {
    // „address" — pošta domů.
    if (isBalikovna) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Tahle objednávka míří na výdejnu — změňte výdejní místo, ne adresu."
      )
    }
    const a = body.address ?? {}
    const first_name = str(a.first_name)
    const last_name = str(a.last_name)
    const address_1 = str(a.address_1)
    const city = str(a.city)
    const postal_code = str(a.postal_code)
    if (!first_name || !last_name || !address_1 || !city || !postal_code) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Vyplňte prosím jméno, adresu, město a PSČ."
      )
    }

    await orderModule.updateOrders([
      {
        id: order.id,
        shipping_address: {
          first_name,
          last_name,
          company: home.company ?? "",
          address_1,
          address_2: str(a.address_2),
          city,
          postal_code,
          country_code: str(a.country_code) || home.country_code || "cz",
          phone: str(a.phone) || home.phone || "",
        },
      },
    ])
    summary = `Nová doručovací adresa: ${address_1}, ${postal_code} ${city}.`
  }

  // Majitelku upozorníme — změna cíle se musí promítnout do balení/štítku.
  // Best-effort: když se notifikace nepovede, změna platí tak jako tak.
  await notifyMerchant(req.scope, {
    key: `delivery-change:${order.id}:${Date.now()}`,
    title: `Objednávka #${order.display_id}: změna doručení`,
    description: `${summary} Zkontrolujte prosím před odesláním / vytvořením štítku.`,
    audience: "owner",
    email: false,
  }).catch(() => undefined)

  res.status(200).json({ ok: true, kind: body.kind ?? "address" })
}
