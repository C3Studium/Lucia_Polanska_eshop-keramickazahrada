import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { QueryClientProvider } from "@tanstack/react-query";
import { useWideLayout } from "../components/order-section";
import { ExpertToggle } from "../lib/expert-mode";
import { useHideNativeCardsBefore } from "../lib/native-cards";
import { adminQueryClient } from "../lib/query-client";
import { CpLabelPanel } from "./cp-label";
import { CpTrackingPanel } from "./cp-tracking";
import { MadeToOrderPanel } from "./made-to-order-order";
import { OrderConsentPanel } from "./order-consent";
import { OrderDelayPanel } from "./order-delay";
import { OrderReturnsPanel } from "./order-returns";
import { OrderStepsPanel } from "./order-steps";

/**
 * „Práce s objednávkou" — pravý sloupec detailu objednávky (17. 11. 2026).
 *
 * Pravidlo stránky: uprostřed se čte, vpravo se jedná.
 *
 *  1. Postup objednávky — kroky s e-maily, jedno tlačítko na aktuální krok,
 *  2. štítek České pošty,
 *  3. reklamace a sledování zásilky (sbalené, otevřou se, když je co řešit),
 *  4. zakázka — cena, zadání od zákazníka, interní poznámka, platby,
 *  5. zpoždění, souhlas (jen expert).
 *
 * Údaje (číslo a souhrn, zákazník, faktura, e-maily, historie) jsou v hlavním
 * sloupci — `order-workspace-main.tsx`.
 *
 * Proč jeden widget: Medusa 2.18 skládá widgety jednoho sloupce v pořadí
 * souborů na disku (na Linuxu jakkoli); jeden widget = pořadí určujeme my.
 *
 * Nativní karty Zákazník a Aktivita nad tímhle widgetem se bez expertního
 * režimu schovají — totéž ukazují naše tabulky Zákazník a Historie.
 *
 * Telefon: pravý sloupec je pod celým hlavním, takže Postup a štítek se na
 * úzkém displeji vykreslí nahoře v hlavním sloupci a tady ne.
 */

/** Jednání — postup a štítek. */
export const OrderNowPanels = ({ order }: { order: AdminOrder }) => (
  <>
    <OrderStepsPanel order={order} />
    <CpLabelPanel order={order} />
  </>
);

const OrderWorkspaceSide = ({ order }: { order: AdminOrder }) => {
  const wide = useWideLayout();
  const ref = useHideNativeCardsBefore<HTMLDivElement>();
  return (
    <div ref={ref} className="flex flex-col gap-y-3">
      {wide && <OrderNowPanels order={order} />}
      <OrderReturnsPanel orderId={order.id} />
      <CpTrackingPanel order={order} />
      {/* Zakázka (cena, zadání, poznámka, platby) vpravo nad Zpožděním —
          přání majitelky 17. 11. 2026: patří k jednání, ne ke čtení. */}
      {/* V jednom sloupci ji vykreslí hlavní sloupec hned pod fakturou. */}
      {wide && <MadeToOrderPanel order={order} />}
      <OrderDelayPanel order={order} />
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
