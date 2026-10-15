/**
 * Je PDF z `pdf-manifest.json` zveřejněné?
 *
 * Zveřejněné = nahrané do úložiště, tedy s absolutní https adresou. Tu do
 * manifestu zapíše `pnpm legal:upload`, a ten nahrává jen finální znění;
 * pracovní PDF (s `[[DOPLNIT]]`) mají jen místní cestu `/legal/…`.
 *
 * Vlastní drobný modul bez závislostí: čte ho klientská patička i serverové
 * stránky objednávky, a registr (`./registry`) s plným zněním dokumentů do
 * prohlížeče nepatří.
 */
export const isPublishedPdfUrl = (url: string): boolean => /^https:\/\//.test(url)
