// Sandboxová podoba `backend/src/lib/legal/legal-manifest.json`.
//
// Na produkci dostanou PDF trvalou https adresu v R2 (`pnpm legal:upload`) a
// potvrzení objednávky je přikládá (Resend si je stáhne z `path`). Do R2 sandbox
// nesmí, takže by e-mail nikdy přílohu neměl. Tady se proto vyrobí kopie
// manifestu, kde má každé PDF adresu https://legal.sandbox.test/legal/<soubor>:
//   - backend ji ověří HEADem → env-guard ji přesměruje na zachytávač,
//   - zachytávač soubor servíruje (jen čte) ze storefront/public/legal/,
//   - zachytávač přílohu „stáhne“ stejně jako Resend a zapíše bajty + sha256.
// `env-guard.cjs` pak při `require(".../lib/legal/legal-manifest.json")` vrátí
// tuhle kopii (SANDBOX_LEGAL_MANIFEST). Kód aplikace se nemění.
//
// `draft` zůstává, jak je — pracovní PDF s [[DOPLNIT]] backend zákazníkovi
// nepošle, a to je správně. Jen pro test mechanismu příloh jde přepnout
// SANDBOX_LEGAL_ALLOW_DRAFT=1 (pak draft=false + `sandbox_draft_overridden`).
import fs from "node:fs"
import path from "node:path"

import { BACKEND_DIR, RUN_DIR } from "./config.mjs"

export const LEGAL_HOST = "legal.sandbox.test"
export const SOURCE_MANIFEST = path.join(BACKEND_DIR, "src", "lib", "legal", "legal-manifest.json")
export const SANDBOX_MANIFEST = path.join(RUN_DIR, "legal-manifest.sandbox.json")

export function writeSandboxManifest({ allowDraft = process.env.SANDBOX_LEGAL_ALLOW_DRAFT === "1" } = {}) {
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(SOURCE_MANIFEST, "utf8"))
  } catch {
    return null
  }
  const summary = []
  for (const [slug, doc] of Object.entries(manifest.documents ?? {})) {
    for (const v of doc?.versions ?? []) {
      if (!v?.pdf?.file) continue
      const original = v.pdf.url
      // Relativní cesta (před nahráním do R2) i už nahraná R2 adresa → sandbox host.
      v.pdf.url = `https://${LEGAL_HOST}/legal/${encodeURIComponent(v.pdf.file)}`
      v.pdf.sandbox_original_url = original
      if (allowDraft && v.pdf.draft) {
        v.pdf.draft = false
        v.pdf.sandbox_draft_overridden = true
      }
      summary.push(`${slug}@${v.version}${v.pdf.draft ? " (draft)" : v.pdf.sandbox_draft_overridden ? " (draft→final SANDBOX)" : ""}`)
    }
  }
  manifest._sandbox = {
    generated_at: new Date().toISOString(),
    note: "Sandboxová kopie — PDF na https://legal.sandbox.test (zachytávač čte storefront/public/legal).",
    allow_draft: allowDraft,
  }
  fs.mkdirSync(RUN_DIR, { recursive: true })
  fs.writeFileSync(SANDBOX_MANIFEST, JSON.stringify(manifest, null, 2))
  return { file: SANDBOX_MANIFEST, summary, allowDraft }
}
