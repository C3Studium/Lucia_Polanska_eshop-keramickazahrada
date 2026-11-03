import { defineRouteConfig } from "@medusajs/admin-sdk";
import { GlobeEurope } from "@medusajs/icons";
import { SectionPage } from "../../components/section-tabs";
import { ObsahWebu } from "../obsah/page";

/**
 * Web — poslední položka menu (3. 11. 2026): odkud se jde upravit texty
 * a fotky webu ve Studiu (ValeCMS) a kde se otevře měření návštěvnosti.
 * Obojí jsou jen odkazy ven, proto jedna položka se dvěma záložkami
 * a úplně dole.
 */
const Page = () => (
  <SectionPage section="web" active="obsah">
    <ObsahWebu />
  </SectionPage>
);

export const config = defineRouteConfig({
  label: "Web",
  icon: GlobeEurope,
  rank: 100,
});

export default Page;
