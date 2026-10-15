import { NextResponse } from "next/server"
import { ALL_VERSIONS } from "@lib/legal/documents"
import { FACTS } from "@lib/legal/facts"
import { LEGAL_PATHS, pdfFileName } from "@lib/legal/registry"
import {
  placeholderCount,
  PRINT_LAYOUT_REVISION,
  printPath,
  printProbes,
} from "@modules/legal-print/meta"
import { printSourceHash } from "@modules/legal-print/source-hash"

/**
 * Seznam verzí právních dokumentů pro `pnpm legal:build`
 * (storefront/scripts/legal-build.mjs).
 *
 * Skript je čisté `.mjs` a TypeScript registru importovat nemůže, proto se
 * ptá běžícího storefrontu. Kromě verzí vrací i fakty o prodávající — z nich
 * skript skládá manifest backendu (patička e-mailů), takže e-maily a PDF čtou
 * tytéž údaje.
 *
 * Nic tajného: jen metadata veřejných dokumentů a veřejné údaje o prodávající.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET() {
  const versions = [...ALL_VERSIONS]
    .sort((a, b) => a.slug.localeCompare(b.slug) || a.version.localeCompare(b.version))
    .map((doc) => ({
      slug: doc.slug,
      version: doc.version,
      title: doc.title,
      pdf: doc.pdf,
      archived: Boolean(doc.archived),
      file: pdfFileName(doc.slug, doc.version),
      printPath: printPath(doc.slug, doc.version),
      sourceHash: printSourceHash(doc),
      placeholders: placeholderCount(doc),
      probes: printProbes(doc),
    }))

  return NextResponse.json(
    {
      schema: 1,
      printLayoutRevision: PRINT_LAYOUT_REVISION,
      facts: FACTS,
      paths: LEGAL_PATHS,
      versions,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
