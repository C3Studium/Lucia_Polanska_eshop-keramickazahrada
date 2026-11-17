import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { QueryClientProvider } from "@tanstack/react-query";
import { useWideLayout } from "../components/order-section";
import { useHideNativeCardsBefore } from "../lib/native-cards";
import { adminQueryClient } from "../lib/query-client";
import { MadeToOrderPanel } from "./made-to-order-order";
import { OrderCustomerPanel } from "./order-customer";
import { OrderEmailsPanel } from "./order-emails";
import { OrderGiftVouchersPanel } from "./order-gift-vouchers";
import { OrderHistoryPanel } from "./order-history";
import { OrderInvoicePanel } from "./order-invoice";
import { OrderPersonalizedPanel } from "./order-personalized";
import { OrderNowPanels } from "./order-workspace";

/**
 * „Práce s objednávkou" — hlavní sloupec detailu objednávky (17. 11. 2026).
 *
 * Shora dolů, jak to majitelka čte (přání 17. 11. 2026):
 *
 *  1. Zákazník — kdo a kam,
 *  2. zakázka — cena a potvrzení, pod tím zadání od zákazníka a interní
 *     poznámka, pak platby (jen když zakázka je),
 *  3. nativní Medusa: číslo objednávky, položky a souhrn (karty Platby
 *     a Nesplněné položky jen v expertním režimu — opakují Souhrn a Postup),
 *  4. Faktura, poukazy, výrobky na rozměr,
 *  5. Odeslané e-maily a Historie.
 *
 * Jak se dostane 1–2 nad nativní karty: Medusa skládá nativní karty i widgety
 * jako sourozence jednoho flex sloupce, nativní první. Widget proto vrací dva
 * bloky — horní s `order: -1` (flexbox ho vykreslí před nativními) a dolní
 * bez něj (zůstane za nimi).
 */
const OrderWorkspaceMain = ({ order }: { order: AdminOrder }) => {
  const wide = useWideLayout();
  const bottom = useHideNativeCardsBefore<HTMLDivElement>([
    "Platby",
    "Nesplněné položky",
    "Unfulfilled Items",
  ]);
  return (
    <>
      <div className="flex flex-col gap-y-3" style={{ order: -1 }}>
        {!wide && <OrderNowPanels order={order} />}
        <OrderCustomerPanel order={order} />
        <MadeToOrderPanel order={order} />
      </div>
      <div ref={bottom} className="flex flex-col gap-y-3">
        <OrderInvoicePanel order={order} />
        <OrderGiftVouchersPanel order={order} />
        <OrderPersonalizedPanel order={order} />
        <OrderEmailsPanel order={order} />
        <OrderHistoryPanel order={order} />
      </div>
    </>
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
