import { AbstractAnalyticsProviderService, MedusaError } from "@medusajs/framework/utils"
import { ProviderIdentifyAnalyticsEventDTO, ProviderTrackAnalyticsEventDTO } from "@medusajs/types"
import { Analytics } from '@segment/analytics-node'

type Options = {
  writeKey: string
}

type InjectedDependencies = {}

class SegmentAnalyticsProviderService extends AbstractAnalyticsProviderService {
  /**
   * `null` when SEGMENT_WRITE_KEY is not set. The provider registers
   * unconditionally in medusa-config, so throwing here crashed the whole boot
   * over a missing ANALYTICS key — analytics must degrade, never take the
   * shop down. Without a client every call is a no-op.
   */
  private client: Analytics | null
  static identifier = "segment"

  constructor(container: InjectedDependencies, options: Options) {
    super()
    if (!options.writeKey) {
      console.warn(
        "[segment] SEGMENT_WRITE_KEY is not set — analytics events will be dropped."
      )
      this.client = null
      return
    }
    this.client = new Analytics({ writeKey: options.writeKey })
  }

  async identify(data: ProviderIdentifyAnalyticsEventDTO): Promise<void> {
    if (!this.client) return
    const anonymousId = data.properties && "anonymousId" in data.properties ? 
      data.properties.anonymousId : undefined
    const traits = data.properties && "traits" in data.properties ? 
        data.properties.traits : undefined

    if ("group" in data) {
      this.client.group({
        groupId: data.group.id,
        userId: data.actor_id,
        anonymousId,
        traits,
        context: data.properties
      })
    } else {
      this.client.identify({
        userId: data.actor_id,
        anonymousId,
        traits,
        context: data.properties
      })
    }
  }

  async track(data: ProviderTrackAnalyticsEventDTO): Promise<void> {
    if (!this.client) return
    const userId = "group" in data ? data.actor_id || data.group?.id : data.actor_id
    const anonymousId = data.properties && "anonymousId" in data.properties ? 
      data.properties.anonymousId : undefined

    if (!userId && !anonymousId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA, 
        `Actor or group ID is required for event ${data.event}`
      )
    }

    this.client.track({
      userId,
      anonymousId,
      event: data.event,
      properties: data.properties,
      timestamp: data.properties && "timestamp" in data.properties ? 
        new Date(data.properties.timestamp) : undefined
    })
  }

  async shutdown(): Promise<void> {
    if (!this.client) return
    await this.client.flush({
      close: true
    })
  }
}

export default SegmentAnalyticsProviderService