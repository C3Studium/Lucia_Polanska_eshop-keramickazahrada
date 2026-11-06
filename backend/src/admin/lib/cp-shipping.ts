/**
 * Rozpoznání zásilky České pošty na objednávce — sdílené widgety „Štítek ČP"
 * (cp-label.tsx) a „Zásilka u České pošty" (cp-tracking.tsx), ať oba řeknou
 * u stejné objednávky to samé: osobní odběr a cizí dopravce se nesledují ani
 * neštítkují.
 *
 * Poznává se z `order.shipping_methods`: data metody (service_code NB/DR,
 * personal_pickup), provider_id možnosti dopravy a nakonec název metody bez
 * diakritiky („balíkovna", „balík", „pošta").
 */

type ShippingMethodLike = {
  name?: string | null;
  data?: Record<string, unknown> | null;
  shipping_option?: { provider_id?: string | null } | null;
};

type OrderWithShipping = {
  shipping_methods?: unknown[] | null;
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const methodsOf = (order: OrderWithShipping): ShippingMethodLike[] =>
  (order.shipping_methods ?? []) as ShippingMethodLike[];

/**
 * Osobní odběr — žádný dopravce, žádný štítek, žádné sledování.
 *
 * Kód služby přebíjí příznak odběru: Medusa data metody dopravy slučuje,
 * takže po výměně osobního odběru za Českou poštu zůstane v datech
 * `personal_pickup: true` vedle `service_code: "DR"` (objednávka #69,
 * 3. 11. 2026). Ten kód zapsal dopravce — platí on. Totéž pravidlo má
 * backend v `lib/personal-pickup.ts`; sdílet ho nejde, administrace
 * z backendu importovat nesmí.
 */
export const isPersonalPickup = (order: OrderWithShipping): boolean =>
  methodsOf(order).some((method) => {
    const data = method?.data || {};
    const code = String(data.service_code ?? "");
    if (code && code !== "PICKUP") return false;
    if (data.personal_pickup === true || code === "PICKUP") return true;
    // Záloha pro metody bez dat — stejná jako v `lib/personal-pickup.ts`.
    const provider = String(method?.shipping_option?.provider_id ?? "");
    const nazev = fold(String(method?.name ?? ""));
    return (
      provider.includes("pickup") ||
      nazev.includes("osobni") ||
      nazev.includes("odber")
    );
  });

/** Zásilka České pošty (Balíkovna NB nebo Balík Do ruky DR). */
export const isCeskaPosta = (order: OrderWithShipping): boolean =>
  methodsOf(order).some((method) => {
    const data = method?.data || {};
    const provider = String(method?.shipping_option?.provider_id ?? "");
    const name = fold(String(method?.name ?? ""));
    return (
      provider.includes("ceska-posta") ||
      data.service_code === "NB" ||
      data.service_code === "DR" ||
      name.includes("balikovna") ||
      name.includes("balik") ||
      name.includes("posta")
    );
  });
