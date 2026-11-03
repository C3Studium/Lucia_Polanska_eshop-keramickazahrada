import { defineRouteConfig } from "@medusajs/admin-sdk";
import { BuildingStorefront } from "@medusajs/icons";
import { SectionPage } from "../../components/section-tabs";
import { DovolenaOznameni } from "../dovolena-oznameni/page";

/**
 * Nastavení obchodu — jedna položka menu místo pěti (3. 11. 2026).
 *
 * Dovolená a oznámení, Doprava a platba, Balení, E-maily obchodu a Zkušební
 * režim jsou věci, které se nastaví a pak se na ně měsíce nesahá. V menu mezi
 * denní prací jen překážely. Teď jsou záložkami tady; každá má svou adresu
 * (`/nastaveni-obchodu/…`) a stránky drží dál svůj kód ve vlastních složkách.
 *
 * První záložka je Dovolená a oznámení — z nich se sem chodí nejčastěji.
 */
const Page = () => (
  <SectionPage section="nastaveni" active="dovolena">
    <DovolenaOznameni />
  </SectionPage>
);

export const config = defineRouteConfig({
  label: "Nastavení obchodu",
  icon: BuildingStorefront,
  // Za vedlejšími stránkami (Statistiky 70), před Právními věcmi (90).
  rank: 80,
});

export default Page;
