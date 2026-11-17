import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Zakázky jsou od 17. 11. 2026 součástí Objednávek (přepínač Vše · Výrobky ·
 * Zakázky · Poptávky) — přání majitele: jedno místo pro všechny objednávky,
 * klik na řádek otevře objednávku a cena, záloha i zadání se řeší tam.
 * Dřívější samostatná stránka s rozbalenými panely ceny skončila; její adresa
 * (a `/zakazky`, `/zakazkova-vyroba/zakazky`) sem přesměruje, i s hledáním.
 *
 * Bez `config`: žádná položka v levém menu.
 */
export const ZakazkyRedirect = () => {
  const [searchParams] = useSearchParams();
  const hledat = searchParams.get("hledat");
  return (
    <Navigate
      to={`/objednavky?druh=zakazky${hledat ? `&hledat=${encodeURIComponent(hledat)}` : ""}`}
      replace
    />
  );
};

export default ZakazkyRedirect;
