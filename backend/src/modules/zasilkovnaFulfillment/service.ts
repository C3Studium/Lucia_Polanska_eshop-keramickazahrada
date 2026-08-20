import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import {
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
} from "@medusajs/framework/types"
import { Builder, Parser } from "xml2js"
import { PACKETA_API_KEY } from "lib/constants"

/**
 * Zásilkovna (Packeta) — DORMANT by decision (2026-08-18): the provider stays
 * registered so past orders keep resolving, but no shipping option offers it
 * until the client decides otherwise.
 *
 * The first draft of this file was a set of live-money bugs waiting for that
 * decision: it attached the full order total as cash-on-delivery to every
 * parcel (prepaid card orders included), hardcoded 2.5 kg, logged the API
 * password in plaintext, and swallowed API failures into a fake success. This
 * version is safe to leave enabled: misconfiguration and API failures THROW,
 * nothing is booked as COD, and no secret reaches a log.
 */
class PacketaProviderService extends AbstractFulfillmentProviderService {
  static identifier = "packeta"

  // Medusa passes (container, options); the old (options) signature silently
  // read the container as options.
  constructor(container: Record<string, unknown>, options?: Record<string, unknown>) {
    super()
    void container
    void options
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: "packeta_pickup", name: "Zásilkovna - výdejní místo" }]
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>
  ) {
    return { ...optionData, ...data }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    _items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    if (!PACKETA_API_KEY) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Zásilkovna není nakonfigurovaná (chybí PACKETA_API_KEY) — zásilku nelze podat."
      )
    }

    const addressId = Number(
      order?.shipping_address?.metadata?.packeta_pickup_point
    )
    if (!addressId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Objednávka nemá vybrané výdejní místo Zásilkovny — zásilku nelze podat."
      )
    }

    const requestBody = {
      createPacket: {
        apiPassword: PACKETA_API_KEY,
        packetAttributes: {
          number: order?.display_id ?? order?.id,
          name: order?.shipping_address?.first_name,
          surname: order?.shipping_address?.last_name,
          company: "Keramická zahrada",
          sendLabelToEmail: true,
          email: order?.email ?? order?.shipping_address?.metadata?.email,
          phone: order?.shipping_address?.phone,
          addressId,
          /*
           * Deliberately NO cash-on-delivery: this provider cannot see how the
           * order was paid, and the previous behaviour — COD equal to the full
           * total on every parcel — made customers pay card orders twice at
           * the counter. If Packeta COD is ever wanted, it needs an explicit
           * signal on the order, not a guess here.
           */
          cod: 0,
          value: Number(order?.total) || 0,
          // Real per-parcel weight needs the variant data this hook does not
          // receive; a configurable default keeps the API happy until then.
          weight: Number(process.env.PACKETA_DEFAULT_WEIGHT_KG) || 1,
          currency: order?.currency_code?.toUpperCase() || "CZK",
          eshop: "keramickazahrada.cz",
        },
      },
    }

    const response = await fetch("https://www.zasilkovna.cz/api/rest", {
      method: "POST",
      body: new Builder().buildObject(requestBody),
    })
    const parsed = await new Parser({ explicitArray: false }).parseStringPromise(
      await response.text()
    )

    const result = parsed?.response
    if (!response.ok || result?.status !== "ok") {
      // Detail without the request (which carries the API password).
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Zásilkovna podání odmítla: ${result?.fault ?? result?.string ?? "neznámá chyba"}`
      )
    }

    const packetId = result?.result?.id
    return {
      data: {
        ...data,
        packeta_packet_id: packetId ?? null,
        packeta_barcode: result?.result?.barcode ?? null,
      },
      // The label arrives by e-mail (sendLabelToEmail) — nothing to serve here.
      labels: [],
    }
  }

  async cancelFulfillment(data: Record<string, unknown>) {
    const packetId = data?.packeta_packet_id
    if (!PACKETA_API_KEY || !packetId) {
      // Nothing was booked with the carrier — nothing to cancel there.
      return {}
    }

    const response = await fetch("https://www.zasilkovna.cz/api/rest", {
      method: "POST",
      body: new Builder().buildObject({
        cancelPacket: { apiPassword: PACKETA_API_KEY, packetId },
      }),
    })
    const parsed = await new Parser({ explicitArray: false }).parseStringPromise(
      await response.text()
    )
    if (parsed?.response?.status !== "ok") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Zásilkovnu se nepodařilo stornovat: ${parsed?.response?.fault ?? "neznámá chyba"}`
      )
    }
    return {}
  }
}

export default PacketaProviderService
