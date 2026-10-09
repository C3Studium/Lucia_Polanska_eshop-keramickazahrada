import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { applyParcelEvents } from "../../../../../lib/parcel-tracking/apply"
import {
  cpCarrierName,
  cpTrackingUrl,
  isSimulateAllowed,
} from "../../../../../lib/parcel-tracking/carrier"
import {
  CP_STATE_TEXTS,
  isSimulatableState,
  SIMULATABLE_STATES,
} from "../../../../../lib/parcel-tracking/classify"
import {
  fetchParcelEvents,
  trackingSource,
  type TrackingSource,
} from "../../../../../lib/parcel-tracking/source"
import {
  ensureParcelTracking,
  findParcelTracking,
  parcelCodeOf,
  serviceCodeOf,
} from "../../../../../lib/parcel-tracking/start"

/**
 * Sledování zásilky ČP pro widget na detailu objednávky
 * (docs/sledovani-zasilek.md §5, widget §7).
 *
 * GET vrací stav i bez záznamu (číslo zásilky z metadat), ať widget umí
 * nabídnout „Začít sledovat". POST má tři akce: `start` (založit z metadat),
 * `refresh` (okamžitý dotaz ČP) a `simulate` (syntetický stav — jen v
 * testovacím prostředí, a schválně TOUŽ cestou jako job: shipment, fáze,
 * e-mail zákazníkovi, upozornění majitelce). Tvar odpovědi je u všech stejný.
 */

type TrackingResponse = {
  tracking: Record<string, unknown> | null
  parcel_code: string | null
  tracking_url: string | null
  simulate_allowed: boolean
  carrier_label: string
  /** `napi` = B2B nAPI s přístupy (oficiální číselník), `public` = veřejný JSON. */
  source: TrackingSource
}

const ORDER_FIELDS = [
  "id",
  "display_id",
  "metadata",
  "shipping_methods.name",
  "shipping_methods.data",
  "shipping_methods.shipping_option.provider_id",
  "fulfillments.id",
  "fulfillments.canceled_at",
  "fulfillments.data",
  "fulfillments.labels.tracking_number",
]

const loadOrder = async (req: MedusaRequest) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: req.params.orderId },
  })
  const order = (data[0] as any) ?? null
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  return order
}

const buildResponse = (order: any, tracking: any | null): TrackingResponse => {
  const parcelCode = tracking?.parcel_code ?? parcelCodeOf(order)
  const serviceCode = tracking?.service_code ?? serviceCodeOf(order)
  const methodName = (order.shipping_methods ?? [])[0]?.name ?? ""
  return {
    tracking: tracking ?? null,
    parcel_code: parcelCode,
    tracking_url: parcelCode ? cpTrackingUrl(parcelCode) : null,
    simulate_allowed: isSimulateAllowed(),
    carrier_label: cpCarrierName(serviceCode, methodName) || "Česká pošta",
    source: trackingSource(),
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const order = await loadOrder(req)
  const tracking = await findParcelTracking(req.scope, order.id)
  res.status(200).json(buildResponse(order, tracking))
}

type TrackingAction =
  | { action: "start" }
  | { action: "refresh" }
  | { action: "simulate"; state?: string }

export const POST = async (
  req: MedusaRequest<TrackingAction>,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as Partial<TrackingAction>
  const order = await loadOrder(req)
  let tracking = await findParcelTracking(req.scope, order.id)

  switch (body.action) {
    case "start": {
      const parcelCode = parcelCodeOf(order)
      if (!parcelCode) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Objednávka nemá číslo zásilky — sledování začne po vygenerování štítku."
        )
      }
      tracking = await ensureParcelTracking(req.scope, {
        order_id: order.id,
        parcel_code: parcelCode,
        service_code: serviceCodeOf(order),
      })
      res.status(200).json(buildResponse(order, tracking))
      return
    }

    case "refresh": {
      if (!tracking) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Zásilka se zatím nesleduje — nejdřív „Začít sledovat".`
        )
      }
      // Chyba sítě je tady chyba pro uživatele (klikl, chce vědět) — ne tichý
      // log jako v jobu. Posíláme 503 rovnou: Medusa by u 500 hlášku přepsala
      // na obecnou „unknown error" a widget by neměl co ukázat.
      let events
      try {
        events = await fetchParcelEvents(tracking.parcel_code)
      } catch (error) {
        res.status(503).json({
          type: "unavailable",
          message:
            (error as Error)?.message ?? "Českou poštu se nepodařilo kontaktovat.",
        })
        return
      }
      const result = await applyParcelEvents(req.scope, tracking, events, "cp")
      res.status(200).json(buildResponse(order, result.tracking))
      return
    }

    case "simulate": {
      if (!isSimulateAllowed()) {
        // Medusa nemá typ chyby pro 403; posíláme ho rovnou ve stejném tvaru.
        res.status(403).json({
          type: "not_allowed",
          message:
            "Simulace stavů je dostupná jen v testovacím prostředí (CP_TRACKING_SIMULATE=1 nebo testovací URL ČP).",
        })
        return
      }
      if (!tracking) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Zásilka se zatím nesleduje — nejdřív „Začít sledovat".`
        )
      }
      const state = (body as { state?: string }).state
      if (!isSimulatableState(state)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Neznámý stav k simulaci. Povolené: ${SIMULATABLE_STATES.join(", ")}.`
        )
      }
      const today = new Date().toISOString().slice(0, 10)
      const result = await applyParcelEvents(
        req.scope,
        tracking,
        [
          {
            id: state,
            text: `${CP_STATE_TEXTS[state]} (simulace)`,
            date: today,
            postoffice: null,
            postcode: null,
          },
        ],
        "simulated"
      )
      res.status(200).json(buildResponse(order, result.tracking))
      return
    }

    default:
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Neznámá akce. Povolené: start, refresh, simulate."
      )
  }
}
