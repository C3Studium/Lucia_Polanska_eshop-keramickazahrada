import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Swatch } from "@medusajs/icons";
import ZakazkyPage from "../prehled/zakazky/page";

/**
 * Zakázky v levém menu (17. 11. 2026). Do té doby byly jen v liště
 * podzáložek Přehledu; ta skončila (Přehled je jen přehled), tak mají
 * vlastní položku hned pod Objednávkami. Stránka je táž jako
 * `/prehled/zakazky` — odkazy na ni dál fungují.
 */
export const config = defineRouteConfig({
  label: "Zakázky",
  icon: Swatch,
  rank: 12,
});

export default ZakazkyPage;
