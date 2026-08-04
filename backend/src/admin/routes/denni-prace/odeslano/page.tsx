import { defineRouteConfig } from "@medusajs/admin-sdk";
import { MerchantOrderQueue } from "../../../components/merchant-order-queue";

const DESCRIPTION =
  "Odeslané objednávky. Nic dalšího po vás nechtějí.";

/**
 * The "Odesláno" queue as its own admin route.
 *
 * Sidebar nesting is derived from the directory structure: because this file lives under
 * `routes/denni-prace/`, the dashboard attaches it to the `/denni-prace` parent item.
 * No `nested` property is involved — that option only targets Medusa's six core sections.
 */
const Page = () => (
  <MerchantOrderQueue stage="shipped" description={DESCRIPTION} />
);

export const config = defineRouteConfig({
  label: "Odesláno",
  rank: 40,
});

export default Page;
