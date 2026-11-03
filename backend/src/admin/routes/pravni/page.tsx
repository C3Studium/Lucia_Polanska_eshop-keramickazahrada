import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ShieldCheck } from "@medusajs/icons";
import { SectionPage } from "../../components/section-tabs";
import { PravniUdaje } from "../pravni-udaje/page";

/**
 * Právní věci — jedna položka menu se dvěma záložkami
 * (3. 11. 2026): údaje, které se dosazují do podmínek a e-mailů, a PDF, na
 * která web odkazuje (formulář k reklamaci apod.). Obojí je „papírování
 * obchodu" a sahá se na to zřídka. Texty samotných podmínek jsou ve Studiu
 * (položka Web).
 */
const Page = () => (
  <SectionPage section="pravni" active="udaje">
    <PravniUdaje />
  </SectionPage>
);

export const config = defineRouteConfig({
  // Krátce, ať se vejde na řádek; co přesně tu je, říkají záložky.
  label: "Právní věci",
  icon: ShieldCheck,
  // Za Nastavením obchodu (80), před Webem (100). Adresa /pravni.
  rank: 90,
});

export default Page;
