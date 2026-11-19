/**
 * Česká pošta do zahraničí — jediná doprava mimo Česko (ceník po zemích
 * v administraci, backend `lib/international-shipping.ts`). Poznává se podle
 * `data.international` z backendu, záložně podle názvu volby.
 */
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs")

export const isInternationalShippingOption = (
  option: { name?: string | null; data?: Record<string, unknown> | null } | null | undefined
): boolean =>
  Boolean(option) &&
  ((option?.data as { international?: unknown } | null | undefined)?.international === true ||
    fold(option?.name ?? "").includes("zahranici"))
