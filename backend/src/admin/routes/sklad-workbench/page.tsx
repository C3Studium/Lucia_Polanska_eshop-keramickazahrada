import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CubeSolid } from "@medusajs/icons";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ZasobyStranka } from "../../components/zasoby-sklad";

/**
 * Sklad+ je od 3. 11. 2026 součást Přehled › Zásoby (`components/zasoby-sklad.tsx`):
 * ukazoval tytéž řádky ze stejného pravidla a obě stránky uměly přidat kusy.
 * Jeho pořadí je tam řazení „Nejdřív o co je zájem" (výchozí), hranice
 * upozornění u řádku a statistiky jako záložka.
 *
 * 14. 11. 2026: tahle adresa už nepřesměrovává, ale stránku Zásob ukazuje sama.
 * Přesměrování na /prehled/zasoby rozsvěcovalo v menu „Přehled", i když
 * člověk klikl na „Sklad" — nevěděl, kde je. Otevírá se pořád na Vyprodáno.
 */
const SkladWorkbenchPage = () => {
  const [params, setParams] = useSearchParams();

  /* Jen při otevření: výchozí záložku Zásob (ta nemá `stav` v adrese) si
     člověk pak vybrat smí — nesmí ho to vracet na Vyprodáno. */
  useEffect(() => {
    if (!params.get("stav")) {
      setParams(
        (p) => {
          p.set("stav", "vyprodano");
          return p;
        },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ZasobyStranka />;
};

export const config = defineRouteConfig({
  label: "Sklad",
  icon: CubeSolid,
  rank: 30,
});

export default SkladWorkbenchPage;
