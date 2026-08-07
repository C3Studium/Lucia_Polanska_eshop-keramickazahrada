import {
  AbstractFulfillmentProviderService,
  Modules,
} from "@medusajs/framework/utils"
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
 * ## Naming, and what the admin actually shows
 *
 * The `identifier` here is only half of the composite provider id — the other
 * half is the registration id in `medusa-config.js`, which is set to
 * `balikovna`. That matters because **the dashboard has no display name for a
 * provider**: `formatProvider` splits the composite id on `_` and shows the
 * *second* segment. With both halves equal the admin read
 * „Ceska Posta Fulfillment"; it now reads „Balikovna".
 *
 * The identifier itself stays `ceska-posta-fulfillment` because the module
 * directory, its migrations and its module key are all named that, and renaming
 * them buys nothing the registration id has not already bought.
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
  /**
   * Carriage before packaging, per service code. These mirror what the flat
   * shipping options charge today, so switching an option to `calculated`
   * cannot silently change the base price out from under her.
   */
  base_price_czk?: Record<string, number>
  /** Used for a piece she has not priced yet, so the catalogue works half-filled. */
  default_packaging_price_czk?: number
}

type InjectedDependencies = {
  logger: Logger
  /**
   * Resolved opportunistically. The calculation context hands over each line's
   * `product.id` but not its metadata, and that is where the packaging price
   * lives — so the product service is looked up rather than assumed. If a
   * future Medusa stops registering it here, `calculatePrice` falls back to
   * carriage alone instead of failing.
   */
  [key: string]: unknown
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

  protected readonly container_: InjectedDependencies

  constructor(container: InjectedDependencies, options: ProviderOptions = {}) {
    super()
    this.logger_ = container.logger as Logger
    this.options_ = options
    this.container_ = container
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
        // Kept from the original stub: ceramics break, and the fragile service
        // is the reason this shop needs a carrier option at all.
        id: "cp-fragile",
        name: "Česká pošta – křehké",
        service_code: CP_SERVICE_CODES.address,
        fragile: true,
      },
      {
        // Returns come back through the same carrier. Ceramics being returned
        // are, if anything, more fragile than when they went out.
        id: "cp-return-fragile",
        name: "Česká pošta – křehké (vrácení)",
        service_code: CP_SERVICE_CODES.address,
        fragile: true,
        is_return: true,
      },
    ]

    // Osobní odběr deliberately lives in its own provider
    // (`src/modules/pickupFulfillment`) rather than here — see its docs.
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

  /**
   * True since 2026-08-07, for packaging — not for carrier rating.
   *
   * The old `false` was about live ČP rating, which still waits on the B2B
   * profile (P4-2). What is calculated here is *her* arithmetic, not theirs:
   * carriage plus what it costs to wrap each piece. That needs no credentials.
   *
   * **An option only calculates if its `price_type` is `calculated`.** That is
   * data on the shipping option, not code — so until she switches the Česká
   * pošta options in the admin, everything keeps charging today's flat prices
   * and nothing changes.
   */
  async canCalculate(): Promise<boolean> {
    return true
  }

  /**
   * What this parcel costs: carriage + the wrapping for every piece in it.
   *
   * ## Never throws
   *
   * The storefront disables a calculated option that returns no price, so an
   * exception here would not surface as an error — it would quietly remove
   * every carrier option from checkout and leave only Osobní odběr. Every
   * failure path therefore falls back to carriage alone, which is exactly
   * today's behaviour.
   *
   * ## Why the metadata is fetched
   *
   * The calculation context carries each line's `product.id` but not its
   * metadata, and `packaging_price` lives there. Reading it server-side also
   * means the price cannot be influenced by anything the browser sent.
   *
   * There is no separate box cost. The box is folded into each piece's
   * packaging price (owner's decision, 2026-08-07), so this sum is the whole
   * of it — no catalogue, no packer, nothing to measure.
   */
  async calculatePrice(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: Record<string, any>
  ): Promise<{ calculated_amount: number; is_calculated_price_tax_inclusive: boolean }> {
    const serviceCode = String(
      (optionData as any)?.service_code ?? CP_SERVICE_CODES.address
    )
    const base =
      this.options_.base_price_czk?.[serviceCode] ??
      (serviceCode === CP_SERVICE_CODES.balikovna ? 90 : 150)

    const flat = { calculated_amount: base, is_calculated_price_tax_inclusive: true }

    try {
      const items: any[] = Array.isArray(context?.items) ? context.items : []
      if (!items.length) return flat

      const productIds = [
        ...new Set(
          items.map((item) => item?.product?.id ?? item?.variant?.product?.id).filter(Boolean)
        ),
      ]
      if (!productIds.length) return flat

      const productModule: any =
        this.container_?.[Modules.PRODUCT] ?? this.container_?.productModuleService
      if (!productModule?.listProducts) {
        // No way to read the metadata here — carriage only, rather than a wrong number.
        return flat
      }

      const products: any[] = await productModule.listProducts(
        { id: productIds },
        { select: ["id", "metadata"] }
      )
      const priceByProduct = new Map<string, number>()
      for (const product of products) {
        const raw = (product?.metadata as any)?.packaging_price
        const parsed = typeof raw === "number" ? raw : Number(raw)
        if (Number.isFinite(parsed) && parsed >= 0) {
          priceByProduct.set(product.id, parsed)
        }
      }

      const fallback = this.options_.default_packaging_price_czk ?? 0

      const packaging = items.reduce((sum, item) => {
        const productId = item?.product?.id ?? item?.variant?.product?.id
        const each = priceByProduct.get(productId) ?? fallback
        const quantity = Number(item?.quantity) || 1
        return sum + each * quantity
      }, 0)

      return {
        calculated_amount: Math.round((base + packaging) * 100) / 100,
        is_calculated_price_tax_inclusive: true,
      }
    } catch (error: any) {
      this.logger_?.warn?.(
        `[ceska-posta] packaging calculation failed, charging carriage only: ${error?.message}`
      )
      return flat
    }
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
