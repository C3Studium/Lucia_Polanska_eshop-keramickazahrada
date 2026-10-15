/**
 * `node --import ./scripts/lib/ts-register.mjs …` — TypeScript ze `src/`
 * v obyčejném Node skriptu (viz `./ts-hooks.mjs`).
 *
 * Zapíná i hook ValeCMS (`valecms.config` / `valecms.types` jako aliasy), aby
 * skript mohl sáhnout na `@c3studium/valecms/server`.
 *
 * ## Jedna cesta pro všechny skripty
 *
 * Hlavičky skriptů dřív nabízely `--import @c3studium/valecms/register.mjs`.
 * Ten v 0.1.52 dál funguje (ověřeno 15. 10. 2026 — `src/register.mjs` v balíčku
 * je), ale zapíná jen hook ValeCMS. Skripty, které sahají na TypeScript ze
 * `src/` (`seed-legal.mjs` přes `@lib/legal/…`), potřebují i `./ts-hooks.mjs`
 * — a dvě různé spouštěcí věty pro skripty v jedné složce se pletou. Hlavičky
 * proto všechny ukazují sem; tenhle soubor umí obojí.
 */
import { register } from "node:module"

register("@c3studium/valecms/loader.mjs", import.meta.url)
register("./ts-hooks.mjs", import.meta.url)
