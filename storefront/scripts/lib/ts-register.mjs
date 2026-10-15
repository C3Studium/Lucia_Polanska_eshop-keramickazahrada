/**
 * `node --import ./scripts/lib/ts-register.mjs …` — TypeScript ze `src/`
 * v obyčejném Node skriptu (viz `./ts-hooks.mjs`).
 *
 * Zapíná i hook ValeCMS (`valecms.config` / `valecms.types` jako aliasy), aby
 * skript mohl sáhnout na `@c3studium/valecms/server` stejně jako seedy
 * spouštěné přes `--import @c3studium/valecms/register.mjs`.
 */
import { register } from "node:module"

register("@c3studium/valecms/loader.mjs", import.meta.url)
register("./ts-hooks.mjs", import.meta.url)
