import { defineRouteConfig } from "@medusajs/admin-sdk";
import { MerchantOrderQueue } from "../../../components/merchant-order-queue";

const DESCRIPTION =
  "Zaplacené objednávky, které ještě nikdo nevzal do ruky.";

/**
 * The "Nové" queue as its own admin route.
 *
 * Sidebar nesting is derived from the directory structure: because this file lives under
 * `routes/denni-prace/`, the dashboard attaches it to the `/denni-prace` parent item.
 * No `nested` property is involved — that option only targets Medusa's six core sections.
 */
const Page = () => (
  <MerchantOrderQueue stage="received" description={DESCRIPTION} />
);

export const config = defineRouteConfig({
  label: "Nové",
  rank: 10,
});

export default Page;
