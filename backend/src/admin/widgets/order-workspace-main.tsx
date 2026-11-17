import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { QueryClientProvider } from "@tanstack/react-query";
import { useElementWidth, useWideLayout } from "../components/order-section";
import { CpLabelPanel } from "./cp-label";
import { OWN, useHideNativeCards, useRaiseNativeCard } from "../lib/native-cards";
import { adminQueryClient } from "../lib/query-client";
import { MadeToOrderPanel } from "./made-to-order-order";
import { OrderCustomerPanel } from "./order-customer";
import { OrderEmailsPanel } from "./order-emails";
import { OrderGiftVouchersPanel } from "./order-gift-vouchers";
import { OrderHistoryPanel } from "./order-history";
import { OrderInvoicePanel } from "./order-invoice";
import { OrderPersonalizedPanel } from "./order-personalized";
import { OrderStepsPanel } from "./order-steps";

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
 * Jak se karty dostanou na svá místa: Medusa skládá nativní karty i widgety
 * jako sourozence jednoho flex sloupce — v sandboxu nativní první, na
 * produkci widgety první. Widget proto vrací dva bloky a všemu nastaví
 * CSS `order` výslovně (viz lib/native-cards): #číslo −3, horní blok −2,
 * Souhrn −1, dolní blok 0.
 */
const OrderWorkspaceMain = ({ order }: { order: AdminOrder }) => {
  const wide = useWideLayout();
  /* Rozvržení podle šířky SLOUPCE (ne okna): na notebooku je hlavní sloupec
     vedle menu a pravého sloupce kolem 800 px i při okně přes 1500 px. */
  const [top, columnWidth] = useElementWidth<HTMLDivElement>();
  const sideBySide = columnWidth >= 760;
  const bottom = useHideNativeCards<HTMLDivElement>([
    "Platby",
    "Payments",
    "Nesplněné položky",
    "Unfulfilled Items",
  ]);
  /* Pořadí výslovně přes CSS `order` — na produkci Medusa kreslí nativní
     karty AŽ ZA widgety (17. 11. 2026), takže na pořadí v DOM spoléhat nejde:
     #číslo −3 · Postup + štítek + Zákazník −2 · Souhrn −1 · Faktura a dál 0. */
  useRaiseNativeCard(bottom, (title) => /^#\d+/.test(title), -3, "cislo");
  useRaiseNativeCard(
    bottom,
    (title) => title === "Souhrn" || title === "Summary",
    -1
  );
  return (
    <>
      <div ref={top} {...OWN} className="flex flex-col gap-y-3" style={{ order: -2 }}>
        {/* Postup hned pod číslem objednávky (17. 11. 2026). Všude stejný
            vodorovný proužek teček — i na telefonu (přání majitele: „stejně
            jako na šířku, je to jednodušší"); dlouhý svislý seznam kroků
            skončil. V širokém sloupci vedle něj štítek České pošty, v úzkém
            pod ním. Když štítek nemá co ukázat (osobní odběr), Postup zabere
            celou šířku. */}
        <div
          className={
            sideBySide ? "flex flex-row items-stretch gap-3" : "flex flex-col gap-3"
          }
        >
          <div className="min-w-0 flex-1 [&>*]:h-full">
            <OrderStepsPanel order={order} layout="row" />
          </div>
          <div
            className={
              sideBySide
                ? "empty:hidden w-[18rem] shrink-0 [&>*]:h-full"
                : "empty:hidden"
            }
          >
            <CpLabelPanel order={order} />
          </div>
        </div>
        <OrderCustomerPanel order={order} />
      </div>
      <div ref={bottom} {...OWN} className="flex flex-col gap-y-3" style={{ order: 0 }}>
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
