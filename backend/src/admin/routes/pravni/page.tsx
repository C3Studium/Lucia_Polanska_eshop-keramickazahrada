import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ShieldCheck } from "@medusajs/icons";
import { SectionPage } from "../../components/section-tabs";
import { PravniUdaje } from "../pravni-udaje/page";

/**
 * Právní věci a texty — jedna položka menu se třemi záložkami.
 *
 * 3. 11. 2026: údaje, které se dosazují do podmínek a e-mailů, a PDF, na
 * která web odkazuje (formulář k reklamaci apod.). Obojí je „papírování
 * obchodu" a sahá se na to zřídka.
 *
 * 9. 11. 2026 přibyly **Texty obchodu** — věty u výrobku, v košíku,
 * v pokladně a na hotové objednávce (`lib/shop-texty.ts`). Nejsou to právní
 * věci, ale patří sem ze stejného důvodu: obchod je čte i bez Studia.
 *
 * Texty samotných podmínek a obsah webu jsou dál ve Studiu (položka Web).
 */
const Page = () => (
  <SectionPage section="pravni" active="udaje">
    <PravniUdaje />
  </SectionPage>
);

export const config = defineRouteConfig({
  // Krátce, ať se vejde na řádek; co přesně tu je, říkají záložky.
  label: "Právní věci a texty",
  icon: ShieldCheck,
  // Za Nastavením obchodu (80), před Webem (100). Adresa /pravni.
  rank: 90,
});

export default Page;
