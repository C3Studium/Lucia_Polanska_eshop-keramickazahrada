import { defineRouteConfig } from "@medusajs/admin-sdk";
import { MerchantOrderQueue } from "../../../components/merchant-order-queue";

const DESCRIPTION =
  "Zabalené objednávky čekající na předání dopravci.";

/**
 * The "K odeslání" queue as its own admin route.
 *
 * Sidebar nesting is derived from the directory structure: because this file lives under
 * `routes/denni-prace/`, the dashboard attaches it to the `/denni-prace` parent item.
 * No `nested` property is involved — that option only targets Medusa's six core sections.
 */
const Page = () => (
  <MerchantOrderQueue stage="shipping" description={DESCRIPTION} />
);

export const config = defineRouteConfig({
  label: "K odeslání",
  rank: 30,
});

export default Page;
