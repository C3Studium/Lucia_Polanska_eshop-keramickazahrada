import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { QueryClientProvider } from "@tanstack/react-query";
import { useWideLayout } from "../components/order-section";
import { ExpertToggle } from "../lib/expert-mode";
import { OWN, useHideNativeCards } from "../lib/native-cards";
import { adminQueryClient } from "../lib/query-client";
import { CpTrackingPanel } from "./cp-tracking";
import { MadeToOrderPanel } from "./made-to-order-order";
import { OrderConsentPanel } from "./order-consent";
import { OrderAdminNotePanel, OrderCustomerNotePanel } from "./order-customer-note";
import { OrderDelayPanel } from "./order-delay";
import { OrderReturnsPanel } from "./order-returns";

/**
 * „Práce s objednávkou" — pravý sloupec detailu objednávky (17. 11. 2026).
 *
 *  1. zakázka (jen na širokém displeji) — cena, zadání, poznámka, platby,
 *  2. reklamace a sledování zásilky (sbalené, otevřou se, když je co řešit),
 *  3. zpoždění, souhlas (jen expert).
 *
 * Postup objednávky, štítek ČP a údaje (číslo, zákazník, souhrn, faktura,
 * e-maily, historie) jsou v hlavním sloupci — `order-workspace-main.tsx`.
 *
 * Proč jeden widget: Medusa 2.18 skládá widgety jednoho sloupce v pořadí
 * souborů na disku (na Linuxu jakkoli); jeden widget = pořadí určujeme my.
 *
 * Nativní karty Zákazník a Aktivita se bez expertního režimu schovají —
 * totéž ukazují naše tabulky Zákazník a Historie.
 */

const OrderWorkspaceSide = ({ order }: { order: AdminOrder }) => {
  const wide = useWideLayout();
  const ref = useHideNativeCards<HTMLDivElement>();
  return (
    <div ref={ref} {...OWN} className="flex flex-col gap-y-3">
      {/* Široký displej (17. 11. 2026, přání majitelky): Postup a vedle
          něj štítek jsou vlevo pod číslem objednávky, vpravo nahoře zakázka. */}
      {/* Poznámky nahoře vpravo (19. 11. 2026): zákazníkova vždy — i „žádná" —,
          pod ní interní pro dílnu (tiskne se v listu pro dílnu). */}
      <OrderCustomerNotePanel order={order} />
      <OrderAdminNotePanel order={order} />
      {wide && <MadeToOrderPanel order={order} />}
      <OrderReturnsPanel orderId={order.id} />
      <CpTrackingPanel order={order} />
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
