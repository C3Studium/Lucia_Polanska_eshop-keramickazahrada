import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CubeSolid } from "@medusajs/icons";
import { Navigate } from "react-router-dom";

/**
 * Sklad+ je od 3. 11. 2026 součást Přehled › Zásoby (`components/zasoby-sklad.tsx`):
 * ukazoval tytéž řádky ze stejného pravidla a obě stránky uměly přidat kusy.
 * Jeho pořadí je tam řazení „Nejdřív o co je zájem" (výchozí), hranice
 * upozornění u řádku a statistiky jako záložka.
 *
 * Tahle adresa jen přesměruje — se Sklad+ otvíral na Vyprodáno, tak i teď.
 * `config` níž je beze změny (položka v menu); rozhodnutí o ní je na Matějovi.
 */
const SkladWorkbenchPage = () => <Navigate to="/prehled/zasoby?stav=vyprodano" replace />;

export const config = defineRouteConfig({
  label: "Sklad",
  icon: CubeSolid,
  rank: 30,
});

export default SkladWorkbenchPage;
