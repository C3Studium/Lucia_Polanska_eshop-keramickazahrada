import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { QueryClientProvider } from "@tanstack/react-query";
import { useWideLayout } from "../components/order-section";
import { ExpertToggle } from "../lib/expert-mode";
import { adminQueryClient } from "../lib/query-client";
import { CpLabelPanel } from "./cp-label";
import { CpTrackingPanel } from "./cp-tracking";
import { MerchantOrderStatePanel } from "./merchant-order-state";
import { OrderCommissionCustomerPanel } from "./order-commission-customer";
import { OrderConsentPanel } from "./order-consent";
import { OrderDelayPanel } from "./order-delay";
import { OrderEmailsPanel } from "./order-emails";
import { OrderInvoicePanel } from "./order-invoice";
import { OrderReturnsPanel } from "./order-returns";

/**
 * „Práce s objednávkou" — všechno naše na detailu objednávky v pevném pořadí
 * (pravidlo 20/80, 3. 11. 2026).
 *
 * Proč jeden widget místo devíti: Medusa 2.18 skládá detail přes
 * LayoutComposer a přípony zón `.before` / `.after` ignoruje — všechny widgety
 * jednoho sloupce dá pod nativní karty v pořadí, v jakém je najde na disku
 * (na Windows abecedně, na Linuxu v produkci jakkoli). Denní práce tak
 * skončila pod e-maily a souhlasy. Jeden widget = pořadí určujeme my:
 *
 *  1. denní: Denní práce (stav + další krok) a štítek ČP,
 *  2. zakázka a faktura (otevřené karty),
 *  3. občasné jako sbalené karty, které se samy otevřou, když v nich je něco
 *     k řešení: reklamace, sledování zásilky, zpoždění, odeslané e-maily,
 *  4. jen v expertním režimu: souhlas s podmínkami (právní důkaz).
 *
 * Jednotlivé karty dál žijí ve svých souborech se svými dotazy a akcemi;
 * tady se jen skládají. Karty zakázek, poukazy a personalizace jsou v hlavním
 * sloupci (`order-workspace-main.tsx`).
 *
 * Telefon: pravý sloupec je pod celým hlavním (položky, platby, plnění…),
 * takže Denní práce a štítek se na úzkém displeji vykreslí v hlavním sloupci
 * a tady ne — nikdy obojí naráz.
 */

/** Denní věci — stav a další krok, pod tím štítek. */
export const OrderNowPanels = ({ order }: { order: AdminOrder }) => (
  <>
    <MerchantOrderStatePanel order={order} />
    <CpLabelPanel order={order} />
  </>
);

const OrderWorkspaceSide = ({ order }: { order: AdminOrder }) => {
  const wide = useWideLayout();
  return (
    <div className="flex flex-col gap-y-3">
      {wide && <OrderNowPanels order={order} />}
      <OrderCommissionCustomerPanel order={order} />
      <OrderInvoicePanel order={order} />
      <OrderReturnsPanel orderId={order.id} />
      <CpTrackingPanel order={order} />
      <OrderDelayPanel order={order} />
      <OrderEmailsPanel order={order} />
      <OrderConsentPanel order={order} />
      <div className="flex justify-end px-2">
        <ExpertToggle />
      </div>
    </div>
  );
};

const OrderWorkspaceWidget = ({ data }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={adminQueryClient}>
    <OrderWorkspaceSide order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
  id: "keramicka-zahrada:order-workspace",
});

export default OrderWorkspaceWidget;
