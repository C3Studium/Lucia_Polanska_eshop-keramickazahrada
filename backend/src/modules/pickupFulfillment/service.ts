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
 * Osobní odběr — the customer collects from the workshop.
 *
 * ## Why this is its own provider
 *
 * It sat under the Česká pošta provider at first, which read badly in the
 * admin: choosing carrier „Balikovna" and then option „Osobní odběr" describes
 * something that never happens. Nothing here involves a carrier — she puts the
 * piece on the counter and the customer takes it — so it is its own provider
 * with its own options.
 *
 * ## It is always record-only
 *
 * There is no carrier to book, so `createFulfillment` records the handover and
 * nothing else. The A1 invariant still applies: the goods are packed, and only
 * the „Vyzvednuto a zaplaceno" action (`complete-personal-pickup.ts`) records
 * that they left — together with the money, which arrives at the same moment.
 */
class PickupFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "pickup"

  protected readonly logger_: Logger

  constructor({ logger }: { logger: Logger }, _options: Record<string, unknown>) {
    super()
    this.logger_ = logger
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "personal-pickup",
        name: "Osobní odběr v dílně",
        service_code: "PICKUP",
        personal_pickup: true,
      },
      {
        // Returns: the customer brings the piece back themselves.
        id: "personal-return",
        name: "Osobní dovoz zpět",
        service_code: "PICKUP",
        personal_pickup: true,
        is_return: true,
      },
    ]
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Carried through so the order's shipping method is recognisably a personal
    // collection later — the ship gate, the card action and the projection all
    // read these two keys.
    return {
      ...data,
      service_code: "PICKUP",
      personal_pickup: true,
    }
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Boolean(data)
  }

  async canCalculate(): Promise<boolean> {
    return false
  }

  async createFulfillment(
    _data: Record<string, unknown>,
    _items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    _order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    return {
      data: {
        mode: "manual",
        service_code: "PICKUP",
        personal_pickup: true,
        recorded_at: new Date().toISOString(),
      },
      labels: [],
    }
  }

  async cancelFulfillment(): Promise<any> {
    // Nothing was ever booked anywhere.
    return {}
  }
}

export default PickupFulfillmentService
