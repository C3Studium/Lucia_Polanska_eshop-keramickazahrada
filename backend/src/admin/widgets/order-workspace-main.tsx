import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { QueryClientProvider } from "@tanstack/react-query";
import { useWideLayout } from "../components/order-section";
import { adminQueryClient } from "../lib/query-client";
import { MadeToOrderPanel } from "./made-to-order-order";
import { OrderGiftVouchersPanel } from "./order-gift-vouchers";
import { OrderPersonalizedPanel } from "./order-personalized";
import { OrderNowPanels } from "./order-workspace";

/**
 * „Práce s objednávkou" — hlavní (široký) sloupec detailu objednávky.
 *
 * Karty zakázek (po jedné na každou zakázkovou položku), dárkové poukazy
 * a výrobky na rozměr; každá karta se bez obsahu nevykreslí. Na úzkém
 * displeji (telefon u pultu) tu navíc nahoře stojí Denní práce a štítek —
 * pravý sloupec je tam až pod vším, viz `order-workspace.tsx`.
 */
const OrderWorkspaceMain = ({ order }: { order: AdminOrder }) => {
  const wide = useWideLayout();
  return (
    <div className="flex flex-col gap-y-3">
      {!wide && <OrderNowPanels order={order} />}
      <MadeToOrderPanel order={order} />
      <OrderGiftVouchersPanel order={order} />
      <OrderPersonalizedPanel order={order} />
    </div>
  );
};

const OrderWorkspaceMainWidget = ({ data }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={adminQueryClient}>
    <OrderWorkspaceMain order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.after",
  id: "keramicka-zahrada:order-workspace-main",
});

export default OrderWorkspaceMainWidget;
