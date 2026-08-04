import { defineRouteConfig } from "@medusajs/admin-sdk";
import { XCircle } from "@medusajs/icons";
import { InventoryAlertList } from "../../components/inventory-alert-list";

/**
 * Vyprodáno (§10, §22).
 *
 * „Sold out" means nothing left to sell, which includes stock that exists but
 * is entirely reserved for paid orders. Variants that do not track stock and
 * made-to-order pieces are excluded — neither can run out.
 */
const VyprodanoPage = () => (
  <InventoryAlertList
    type="out"
    title="Vyprodáno"
    description="Kousky, které došly úplně. Zákazníci si je nemohou objednat, dokud nepřidáte nové."
    emptyTitle="Nic není vyprodané"
    emptyDescription="Jakmile něčeho zbude nula kusů, objeví se to tady."
  />
);

export const config = defineRouteConfig({
  label: "Vyprodáno",
  icon: XCircle,
  nested: "/inventory",
  rank: 20,
});

export default VyprodanoPage;
