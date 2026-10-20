// Generuje `pnpm legal:build` (storefront/scripts/legal-build.mjs) — needitovat ručně.
//
// Otisky znění právních dokumentů, jejichž text přišel ze Studia (typ
// „Právní dokumenty"). Soubor `<slug>@<verze>.json` je přesně to znění,
// ze kterého `legal:build` vytiskl PDF; po zveřejnění PDF (`legal:upload`)
// se web vykresluje jen z něj, ne z CMS. Statické importy, aby je Next
// zabalil do serverového balíku.
import type { LegalDocumentVersion } from "../../types"

export const SNAPSHOTS: LegalDocumentVersion[] = []
