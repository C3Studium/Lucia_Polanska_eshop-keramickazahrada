import { NextResponse } from "next/server"
import { getLegalFacts } from "@lib/data/legal-facts"
import { getPublishedLegalRegistry } from "@lib/data/legal-registry"
import { sameLegalText } from "@lib/legal/cms"
import { LEGAL_PATHS, pdfFileName, pragueToday } from "@lib/legal/registry"
import {
  placeholderCount,
  PRINT_LAYOUT_REVISION,
  printPath,
  printProbes,
} from "@modules/legal-print/meta"
import { printSourceHash, usedFacts } from "@modules/legal-print/source-hash"

/**
 * Seznam verzí právních dokumentů pro `pnpm legal:build`
 * (storefront/scripts/legal-build.mjs).
 *
 * Skript je čisté `.mjs` a TypeScript registru importovat nemůže, proto se
 * ptá běžícího storefrontu. Verze jsou SLOUČENÉ (repo + publikované znění ze
 * Studia, `getPublishedLegalRegistry()` — koncepty nikdy) a u každé:
 *
 * - `source` — odkud text je (`repo` / `cms`), `locked` — vydané znění;
 * - `facts` — fakty, se kterými se tiskne (u vydané otisk z manifestu, jinak
 *   živé z administrace) a které dokument opravdu používá; skript je zapíše
 *   do záznamu manifestu (`entry.facts`);
 * - `sourceHash` z téhož textu a týchž faktů;
 * - `document` — celé znění, jen když přišlo ze Studia a v repu ho ještě
 *   nikdo nemá (skript ho zapíše jako otisk `documents/snapshots/`);
 * - `cmsDiffers` — u vydané verze: Studio drží pod stejným klíčem jiný text
 *   (na webu se nepoužije, skript na to upozorní);
 * - `hasRepoCopy` — je verze v repu (TS modul / otisk)? Bez ní by při výpadku
 *   CMS ze stránky zmizela.
 *
 * Nahoře `cms` — kolik znění se ze Studia načetlo / použilo / zahodilo (skript
 * to vypíše, aby nečitelné CMS nevypadalo jako prázdné) a `today` (pražské
 * datum, podle kterého skript pozná platná znění).
 *
 * `facts` nahoře jsou živé fakty o prodávající — z nich skript skládá
 * manifest backendu (patička e-mailů), takže e-maily a PDF čtou tytéž údaje.
 *
 * Nic tajného: jen metadata veřejných dokumentů a veřejné údaje o prodávající.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const [registry, liveFacts] = await Promise.all([getPublishedLegalRegistry(), getLegalFacts()])

  const versions = registry
    .all()
    .sort((a, b) => a.slug.localeCompare(b.slug) || a.version.localeCompare(b.version))
    .map((doc) => {
      const facts = registry.factsFor(doc.slug, doc.version, liveFacts)
      const source = registry.sourceOf(doc.slug, doc.version) ?? "repo"
      const locked = registry.isLocked(doc.slug, doc.version)
      const repoCopy = registry.repoVersion(doc.slug, doc.version)
      const repoMatches = source === "cms" ? Boolean(repoCopy && sameLegalText(doc, repoCopy)) : null
      const cmsCopy = locked ? registry.cmsVersion(doc.slug, doc.version) : null
      const hasRepoCopy = Boolean(repoCopy)
      return {
        slug: doc.slug,
        version: doc.version,
        title: doc.title,
        pdf: doc.pdf,
        archived: Boolean(doc.archived),
        file: pdfFileName(doc.slug, doc.version),
        printPath: printPath(doc.slug, doc.version),
        source,
        locked,
        sourceHash: printSourceHash(doc, facts),
        facts: usedFacts(doc, facts),
        placeholders: placeholderCount(doc, facts),
        probes: printProbes(doc, facts),
        repoMatches,
        hasRepoCopy,
        ...(source === "cms" && !repoMatches ? { document: doc } : {}),
        ...(cmsCopy && repoCopy ? { cmsDiffers: !sameLegalText(cmsCopy, repoCopy) } : {}),
      }
    })

  return NextResponse.json(
    {
      schema: 2,
      printLayoutRevision: PRINT_LAYOUT_REVISION,
      today: pragueToday(),
      cms: registry.cmsStats(),
      facts: liveFacts,
      paths: LEGAL_PATHS,
      versions,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
