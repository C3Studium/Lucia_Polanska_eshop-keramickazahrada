/**
 * Jména, pod kterými právní dokumenty žijí v CMS — samostatně, bez závislostí,
 * aby je zámek Studia (`./cms-guard.ts`) a skripty dostaly bez registru.
 */

/** Typ dokumentu ve Studiu (`valecms.types.ts`). */
export const LEGAL_CMS_TYPE = "pravniDokument"

/** `legacy_source` dokumentů, které založil `scripts/seed-legal.mjs` (`legacy_id` = `slug@verze`). */
export const LEGAL_CMS_LEGACY_SOURCE = "pravni-dokument"
