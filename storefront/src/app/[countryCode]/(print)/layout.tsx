import type { Metadata } from "next"
import { PRINT_CSS } from "@modules/legal-print/print-css"

/**
 * Tiskové stránky (PDF právních dokumentů) — bez navigace, patičky, lišty
 * cookies a animací. Kořenový layout se obejít nedá, proto tiskový styl
 * schová všechno, co neleží v `[data-legal-print-shell]` (viz print-css).
 *
 * Stránky nejsou pro vyhledávače: dokument má svou stránku na webu, tohle je
 * jen předloha pro `pnpm legal:build`.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-legal-print-shell="">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      {children}
    </div>
  )
}
