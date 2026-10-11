import { revalidatePath } from "next/cache"

/**
 * Stránky, které vykreslují stav objednávky (položky, částky, doručovací
 * adresu) — po změně objednávky (úprava položek, změna cíle doručení) se musí
 * vykreslit znovu.
 *
 * Tvar cesty = cesta souboru v `app/` VČETNĚ skupiny `(main)` a slotu
 * `@dashboard`: implicitní značka stránky, se kterou
 * `revalidatePath(…, "page")` porovnává, se staví z `routeModule.definition.page`
 * (viz `app-paths-manifest`: `/[countryCode]/(main)/store/page`), ne z URL.
 * Bez skupiny by se značka neshodla a server by nezneplatnil nic.
 *
 * Samostatný modul (ne konstanta v `order-edit.ts`), protože soubor s
 * „use server" smí exportovat jen asynchronní funkce — a seznam potřebují dvě
 * datové vrstvy (změna doručení i úprava položek).
 */
export const ORDER_PAGE_PATHS = [
  "/[countryCode]/(main)/order/[id]/confirmed",
  "/[countryCode]/(main)/order/[id]/edit",
  "/[countryCode]/(main)/order/[id]/claims",
  "/[countryCode]/(main)/account/@dashboard/orders",
  "/[countryCode]/(main)/account/@dashboard/orders/details/[id]",
]

/**
 * Zahodit uloženou podobu stránek objednávky. Volá se JEN ze serverové akce:
 * tam `revalidatePath` navíc nastaví `pathWasRevalidated`, odpověď akce nese
 * znovu vykreslený strom a klient kvůli tomu zahodí celou router cache — návrat
 * Zpět na potvrzení tak neukáže starý stav. Podrobně u `changeOrderDelivery`.
 */
export function revalidateOrderPages() {
  for (const path of ORDER_PAGE_PATHS) revalidatePath(path, "page")
}
