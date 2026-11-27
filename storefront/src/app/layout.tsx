import SiteChrome from "@modules/layout/components/site-chrome"
import MotionPreferenceProvider from "@lib/context/MotionPreferenceProvider"
import EffectBudgetFlag from "@modules/layout/components/effect-budget-flag"
import ScrollResetOnRoute from "@lib/helpers/scrollResetOnRoute"
import SessionVersionWatch from "@modules/layout/components/session-version"
import { bootResetScript } from "@lib/util/session-version"
import { RELOAD_KEEPER_JS } from "@lib/util/reload-keeper"
import { POLYFILLS_JS, VIEWPORT_GUARD_JS } from "@lib/util/viewport-guard"
import { StateProvider } from "@lib/context/StateContext"
import { getBaseURL } from "@lib/util/env"
import CookieNotice from "@modules/layout/CookieNotice"
import Analytics from "@modules/analytics"
import AhrefsAnalytics from "@modules/analytics/ahrefs-analytics"
import {
  consentDefaultScript,
  gaMeasurementId,
} from "@modules/analytics/consent-mode"
import { Metadata } from "next"
import { getLegalFacts } from "@lib/data/legal-facts"
import { LegalFactsProvider } from "@lib/legal/facts-context"
import "styles/globals.scss"
import StudioClient from "@c3studium/valecms/manage/appClient.jsx";
import { getSiteSeo, seoMetadata } from "@c3studium/valecms/server/site"

/* Obrázek pro sdílení (WhatsApp, Messenger, X). Dřív app/opengraph-image.jpg —
   soubor v app/ má ale v Next přednost před vším, takže by obrázek nastavený
   ve Studiu (SEO a sdílení) nikdy nevyhrál. Teď je výchozí a Studio ho přepíše. */
const OG_DEFAULT = {
  url: "/og-default.jpg",
  alt: "Keramická zahrada — autorská keramika pro zahradu i domov, Lucie Polanská, ateliér v Putimi",
}

const baseMetadata: Metadata = {
  openGraph: { images: [OG_DEFAULT] },
  twitter: { card: "summary_large_image", images: [OG_DEFAULT.url] },
  metadataBase: new URL(getBaseURL()),
  /* Ikona v záložce: logo „Lu" s ptáčkem na krémovém čtverci (19. 11. 2026) —
     černé logo samo by na tmavém panelu prohlížeče zmizelo. */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Every page inherits the brand suffix; pages that are the brand itself opt out
  // with `title: { absolute: … }`.
  title: {
    default: "Keramická zahrada | Autorská keramika Lucie Polanské",
    template: "%s | Keramická zahrada",
  },
  description:
    "Ručně tvořená keramika pro zahradu i domov z ateliéru Lucie Polanské v Putimi. Hotové kusy, zakázková výroba i keramické kurzy.",
}

/* SEO ze Studia (SEO a sdílení) nad metadaty z kódu: přepíše jen to, co je ve
   Studiu vyplněné — prázdný dokument nechá web přesně jako dřív. */
export async function generateMetadata(): Promise<Metadata> {
  try {
    return seoMetadata(await getSiteSeo(), null, baseMetadata)
  } catch {
    return baseMetadata
  }
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const uklidPoStareVerzi = bootResetScript()
  // Právní údaje obchodu (administrace → „Právní údaje", cache 60 s) pro
  // klientské komponenty hluboko ve stromu — předsmluvní informace v pokladně
  // a v rychlém nákupu, právní sekce Dotazů. Viz `@lib/legal/facts-context`.
  const legalFacts = await getLegalFacts()
  // Výchozí stav Google Consent Mode (vše zakázané). Prázdné, když měření
  // nemá ID — pak se nevloží nic. Viz `@modules/analytics`.
  const vychoziSouhlas = consentDefaultScript(
    gaMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
  )

  return (
    /* suppressHydrationWarning: skript výšky okna (viewport-guard) píše na
       <html> proměnné --kz-vh ještě před hydratací — patří jen tomuto prvku. */
    <html lang="cs" data-mode="light" suppressHydrationWarning>
      <body>
        {/* Doplňky funkcí pro starší prohlížeče — jako ÚPLNĚ první, ještě
            před kódem Next.js (lib/util/viewport-guard, 20. 11. 2026). */}
        <script dangerouslySetInnerHTML={{ __html: POLYFILLS_JS }} />
        {/* Úklid po předchozí verzi obchodu. Musí běžet dřív než cokoli
            jiného na stránce, proto je to vložený skript a ne komponenta:
            aplikace se tak nikdy nedostane ke stavu po verzi, která už
            neběží. Viz `@lib/util/session-version`. */}
        {uklidPoStareVerzi ? (
          <script dangerouslySetInnerHTML={{ __html: uklidPoStareVerzi }} />
        ) : null}
        {/* Strážce obnovení po nové verzi: uloží rozepsaná pole, obnoví
            stránku a pole vrátí (lib/util/reload-keeper, 18. 11. 2026). */}
        <script dangerouslySetInnerHTML={{ __html: RELOAD_KEEPER_JS }} />
        {/* Telefony, hlavně iPhone a starší Safari: bez přiblížení při psaní,
            spodní lišta nad sbalenou lištou Safari, klávesnice se zavře
            ťuknutím mimo pole (lib/util/viewport-guard, 19. 11. 2026). */}
        <script dangerouslySetInnerHTML={{ __html: VIEWPORT_GUARD_JS }} />
        {vychoziSouhlas ? (
          <script
            id="kz-consent-default"
            dangerouslySetInnerHTML={{ __html: vychoziSouhlas }}
          />
        ) : null}
        <SessionVersionWatch />
        <ScrollResetOnRoute />
        {/* Stamps the effect budget on <html> for every page, including the ones that render
            outside the (main) layout and have no shader of their own. */}
        <EffectBudgetFlag />
        <MotionPreferenceProvider>
          {/* Lišta souhlasu s cookies — JEDNOU pro celý web, ne v layoutu
              každé skupiny. Tak funguje „Nastavení cookies" z patičky i v
              pokladně a v rychlém nákupu a lišta se při přechodu z obchodu do
              pokladny nepřipojuje znovu. Před obsahem stránky, aby k ní
              klávesnice došla jako k první. Nad /studio se nevykreslí. */}
          <CookieNotice />
          <StateProvider>
            <LegalFactsProvider facts={legalFacts}>
              {/* Rám stránky a plynulé scrollování — obojí vynechané nad
                  /studio, kde je to aplikace, ne stránka. Viz komponentu. */}
              <SiteChrome>{props.children}</SiteChrome>
            </LegalFactsProvider>
          </StateProvider>
        </MotionPreferenceProvider>
        {/* Google Analytics — jen s ID v prostředí a se souhlasem. */}
        <Analytics />
        {/* Ahrefs Web Analytics — se souhlasem, mimo stránky s tokenem a účet. */}
        <AhrefsAnalytics />
        <StudioClient />
      </body>
    </html>
  )
}
