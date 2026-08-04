import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import type {
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
} from "@medusajs/framework/types"

/**
 * Česká pošta / Balíkovna fulfilment provider (WorkflowPlan.md D8, P4-1).
 *
 * ## Why the module keeps its old name
 *
 * The identifier stays `ceska-posta-fulfillment` deliberately. The live
 * shipping option `so_01K2JNAER4GEGP0R011HC37PWS` carries
 * `provider_id = "ceska-posta-fulfillment_ceska-posta-fulfillment"` (P0-1), and
 * changing the identifier would orphan it — every existing option would have to
 * be repointed in production. The name is historical; the provider is now
 * Balíkovna-aware.
 *
 * ## What it replaces
 *
 * The previous version was a stub: it advertised two options and implemented no
 * `createFulfillment` at all, so the one-click ship failed outright for every
 * Česká pošta order. Anything is better than that, but „anything" is not the
 * bar — see the two modes below.
 *
 * ## Record-only mode, and why it is not a lie
 *
 * With no credentials configured, `createFulfillment` records the parcel and
 * returns `data.mode = "manual"` with no labels. That is a truthful statement:
 * the items *are* packed and inventory *is* decremented, but no carrier has
 * been told anything.
 *
 * The ship workflow reads that flag and **stops before creating a shipment**
 * (A1): no „odesláno" status, no shipment e-mail, no stage change. The order
 * waits in K odeslání showing „Čeká na ruční podání zásilky." until she
 * confirms she has actually handed it over. This is the whole point — a
 * customer must never be told a parcel is on its way because a database row
 * exists.
 *
 * ## API mode
 *
 * Once `BALIKOVNA_API_*` is configured, `createFulfillment` books a real parcel
 * and returns `mode: "api"` with a tracking number and label, and the single
 * click ships end to end because the carrier genuinely has the parcel.
 *
 * **That call is not implemented yet (P4-2)** — it needs a ČP B2B profile that
 * does not exist. The seam is marked below and the mode detection already
 * works, so wiring it is additive rather than a rewrite.
 */

type ProviderOptions = {
  api_url?: string
  api_token?: string
  api_secret?: string
  customer_id?: string
  /** Fallback when no product in the parcel carries a weight (D2). */
  default_parcel_weight_kg?: number
}

type InjectedDependencies = {
  logger: Logger
}

/** Service codes as Česká pošta names them. `NB` is „Do Balíkovny". */
export const CP_SERVICE_CODES = {
  balikovna: "NB",
  address: "DR",
} as const

export type FulfillmentMode = "manual" | "api"

class CeskaPostaFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "ceska-posta-fulfillment"

  protected readonly logger_: Logger
  protected readonly options_: ProviderOptions

  constructor({ logger }: InjectedDependencies, options: ProviderOptions = {}) {
    super()
    this.logger_ = logger
    this.options_ = options
  }

  /**
   * Credentials are all-or-nothing: a half-configured provider that fails
   * mid-shipment is worse than one that never tried, because the first leaves
   * an order believing it was dispatched.
   */
  private hasCredentials(): boolean {
    return Boolean(
      this.options_.api_url &&
        this.options_.api_token &&
        this.options_.api_secret &&
        this.options_.customer_id
    )
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "balikovna",
        name: "Balíkovna",
        service_code: CP_SERVICE_CODES.balikovna,
      },
      {
        id: "cp-address",
        name: "Česká pošta – na adresu",
        service_code: CP_SERVICE_CODES.address,
      },
      {
        id: "personal-pickup",
        name: "Osobní odběr",
        // Nothing is ever handed to a carrier; she gives it to the customer.
        service_code: "PICKUP",
        is_personal_pickup: true,
      },
    ]
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Carrier-side validation belongs with the carrier call (P4-2). Until then
    // the data is passed through unchanged rather than pretending to check it.
    return { ...data, service_code: optionData?.service_code }
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Boolean(data)
  }

  async canCalculate(): Promise<boolean> {
    // Prices are the flat ones configured on the shipping option. Live rating
    // would need the same B2B profile P4-2 waits for.
    return false
  }

  /**
   * Records the parcel — and, once credentials exist, books it.
   *
   * The returned `data` is what the ship workflow branches on, so its shape is
   * load-bearing: `mode` decides whether a shipment may follow automatically.
   */
  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    const serviceCode = String(data?.service_code ?? CP_SERVICE_CODES.address)
    const isPersonalPickup = serviceCode === "PICKUP"

    // Personal collection never involves a carrier at all, so it is always
    // record-only regardless of configuration.
    if (isPersonalPickup) {
      return {
        data: {
          mode: "manual" satisfies FulfillmentMode,
          service_code: serviceCode,
          personal_pickup: true,
          recorded_at: new Date().toISOString(),
        },
        labels: [],
      }
    }

    if (!this.hasCredentials()) {
      this.logger_.info(
        `[ceska-posta] Zásilka pro objednávku ${
          order?.display_id ?? order?.id ?? "?"
        } zaznamenána bez napojení na dopravce — chybí BALIKOVNA_API_* údaje. ` +
          `Podání u dopravce potvrdí ručně obsluha.`
      )

      return {
        data: {
          mode: "manual" satisfies FulfillmentMode,
          service_code: serviceCode,
          weight_kg: this.parcelWeight(items),
          recorded_at: new Date().toISOString(),
        },
        labels: [],
      }
    }

    // ─── P4-2 seam ──────────────────────────────────────────────────────────
    // The real nAPI (B2BZasilka) call goes here: POST parcelService for a single
    // parcel, then parcelPrinting for the PDF label. It needs a ČP B2B profile
    // that does not exist yet, and the request-signing scheme ships with that
    // profile's spec — guessing it would produce a provider that looks finished
    // and fails on the first real parcel.
    //
    // Until then, configured credentials still fall through to record-only
    // rather than throwing: a missing integration must never block her from
    // shipping.
    this.logger_.warn(
      "[ceska-posta] BALIKOVNA_API_* jsou nastavené, ale volání dopravce ještě není implementované (P4-2). " +
        "Zásilka se zaznamenává jen lokálně."
    )

    return {
      data: {
        mode: "manual" satisfies FulfillmentMode,
        service_code: serviceCode,
        weight_kg: this.parcelWeight(items),
        recorded_at: new Date().toISOString(),
        pending_carrier_integration: true,
      },
      labels: [],
    }
  }

  /**
   * Parcel weight from the items, falling back to the configured default (D2).
   * The old Packeta provider hardcoded 2.5 kg for every parcel regardless of
   * contents, which is how a shop overpays on every small order.
   */
  private parcelWeight(
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[]
  ): number {
    const summed = (items || []).reduce((total, item) => {
      const quantity = Number((item as any)?.quantity ?? 0) || 0
      const weightGrams = Number((item as any)?.variant?.weight ?? 0) || 0
      return total + (weightGrams / 1000) * quantity
    }, 0)

    if (summed > 0) {
      return Math.round(summed * 1000) / 1000
    }
    return Number(this.options_.default_parcel_weight_kg ?? 2.5)
  }

  async cancelFulfillment(fulfillment: Record<string, unknown>): Promise<any> {
    const mode = (fulfillment as any)?.data?.mode ?? (fulfillment as any)?.mode

    if (mode === "api") {
      // P4-2: cancel the booked parcel with the carrier here.
      this.logger_.warn(
        "[ceska-posta] Zrušení zásilky u dopravce zatím není implementované (P4-2)."
      )
    }

    // Nothing to undo in record-only mode — no carrier was ever told.
    return {}
  }

  // No documents in record-only mode; labels arrive with the carrier call
  // (P4-2). The base class already returns empty for all of these, so they are
  // left to it rather than overridden with the same thing.
}

export default CeskaPostaFulfillmentService
