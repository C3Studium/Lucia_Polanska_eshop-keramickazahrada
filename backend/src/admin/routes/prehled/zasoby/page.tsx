import { ZasobyStranka } from "../../../components/zasoby-sklad";

/**
 * Zásoby — what she has, what is running out, what is gone.
 *
 * ## Why restocking happens here rather than in native Sklad
 *
 * Native inventory is three clicks deep and asks for an absolute number: open
 * the item, open the location level, type what the total should now be. After
 * a firing she is holding six new mugs and thinking „six more", not „the total
 * is now fourteen" — and the arithmetic in between is where mistakes live.
 *
 * So the field here adds. She types 6, confirms, and the row updates. The
 * absolute number still exists on the native page for the times a count is
 * genuinely wrong.
 *
 * The rules behind the three tabs are the shared ones in
 * `lib/inventory-alerts.ts`, so this page, the Přehled tiles and the morning
 * job can never disagree about what „dochází" means.
 */

/*
 * 3. 11. 2026: stránka je sloučená se Sklad+ (poptávka, hranice, statistiky,
 * naskladnění po výpalu) a žije v `components/zasoby-sklad.tsx`; `/sklad-workbench`
 * přesměrovává sem. Adresa i `?stav=` zůstaly — odkazují na ně dlaždice Přehledu.
 */
export default ZasobyStranka;
