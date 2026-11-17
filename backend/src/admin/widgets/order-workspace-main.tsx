import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { QueryClientProvider } from "@tanstack/react-query";
import { useMinWidth, useWideLayout } from "../components/order-section";
import { CpLabelPanel } from "./cp-label";
import { useHideNativeCardsBefore, useRaiseNativeCard } from "../lib/native-cards";
import { adminQueryClient } from "../lib/query-client";
import { MadeToOrderPanel } from "./made-to-order-order";
import { OrderCustomerPanel } from "./order-customer";
import { OrderEmailsPanel } from "./order-emails";
import { OrderGiftVouchersPanel } from "./order-gift-vouchers";
import { OrderHistoryPanel } from "./order-history";
import { OrderInvoicePanel } from "./order-invoice";
import { OrderPersonalizedPanel } from "./order-personalized";
import { OrderStepsPanel } from "./order-steps";
import { OrderNowPanels } from "./order-workspace";

/**
 * „Práce s objednávkou" — hlavní sloupec detailu objednávky (17. 11. 2026).
 *
 * Shora dolů — nejdůležitější nahoře (přání majitelky 17. 11. 2026):
 *
 *  1. číslo objednávky (nativní karta, posunutá nahoru přes `order`),
 *  2. Postup objednávky (v jednom sloupci i se štítkem ČP),
 *  3. Zákazník — kdo a kam,
 *  4. nativní Souhrn (položky, součty; karty Platby a Nesplněné položky
 *     jen v expertním režimu — opakují Souhrn a Postup),
 *  5. Faktura; zakázka jen v jednom sloupci (na širokém je vpravo nahoře
 *     a pod ní štítek), poukazy, výrobky na rozměr,
 *  5. Odeslané e-maily a Historie.
 *
 * Jak se dostane Zákazník nad nativní karty: Medusa skládá nativní karty i widgety
 * jako sourozence jednoho flex sloupce, nativní první. Widget proto vrací dva
 * bloky — horní s `order: -1` (flexbox ho vykreslí před nativními) a dolní
 * bez něj (zůstane za nimi).
 */
const OrderWorkspaceMain = ({ order }: { order: AdminOrder }) => {
  const wide = useWideLayout();
  const rowSteps = useMinWidth(768);
  const bottom = useHideNativeCardsBefore<HTMLDivElement>([
    "Platby",
    "Nesplněné položky",
    "Unfulfilled Items",
  ]);
  // Číslo objednávky („#52", stav platby, „…") úplně nahoru, nad Zákazníka.
  useRaiseNativeCard(bottom, (title) => /^#\d+/.test(title), -2);
  return (
    <>
      <div className="flex flex-col gap-y-3" style={{ order: -1 }}>
        {/* Postup hned pod číslem objednávky (17. 11. 2026). Od tabletu
            výš vodorovná řada kroků a vedle ní štítek České pošty (dvě karty
            v jednom řádku); na telefonu pod sebou. Když štítek nemá co
            ukázat (osobní odběr), Postup zabere celou šířku. */}
        {rowSteps ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1 [&>*]:h-full">
              <OrderStepsPanel order={order} layout="row" />
            </div>
            <div className="empty:hidden lg:w-[19rem] lg:shrink-0 [&>*]:h-full">
              <CpLabelPanel order={order} />
            </div>
          </div>
        ) : (
          <OrderNowPanels order={order} />
        )}
        <OrderCustomerPanel order={order} />
      </div>
      <div ref={bottom} className="flex flex-col gap-y-3">
        <OrderInvoicePanel order={order} />
        {/* Zakázka je na širokém displeji vpravo (order-workspace.tsx). */}
        {!wide && <MadeToOrderPanel order={order} />}
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
