import { MedusaService } from "@medusajs/framework/utils"
import ActivityEvent from "./models/activity-event"

/**
 * Provozní deník. Zapisuje se přes `lib/provozni-hlidka/zapis.ts` (ten drží
 * pravidlo „zápis nikdy neshodí to, co zapisuje"), čte ho denní souhrn,
 * stránka Provoz v administraci a hlídka.
 */
class ActivityLogModuleService extends MedusaService({
  ActivityEvent,
}) {}

export default ActivityLogModuleService
