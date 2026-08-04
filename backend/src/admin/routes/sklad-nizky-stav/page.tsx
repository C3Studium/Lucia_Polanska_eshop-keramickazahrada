import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ExclamationCircle } from "@medusajs/icons";
import { InventoryAlertList } from "../../components/inventory-alert-list";

/**
 * Nízký stav (§10, §22).
 *
 * Availability is `stocked − reserved`: pieces reserved for orders already paid
 * for are not sellable, and counting them is how a shop oversells. The
 * threshold is the shop-wide setting unless an item overrides it, and
 * made-to-order variants never appear — a commissioned piece is made after it
 * is ordered, so „0 available" is its normal state.
 */
const NizkyStavPage = () => (
  <InventoryAlertList
    type="low"
    title="Nízký stav"
    description="Kousky, kterých už zbývá málo — ať stihnete dopéct dřív, než dojdou úplně. Počítáme jen to, co je opravdu k prodeji: rezervované kusy už patří někomu jinému."
    emptyTitle="Zásoby jsou v pořádku"
    emptyDescription="Jakmile něčeho začne ubývat, objeví se to tady."
  />
);

export const config = defineRouteConfig({
  label: "Nízký stav",
  icon: ExclamationCircle,
  nested: "/inventory",
  rank: 10,
});

export default NizkyStavPage;
