import SiteChrome from "@modules/layout/components/site-chrome"
import MotionPreferenceProvider from "@lib/context/MotionPreferenceProvider"
import EffectBudgetFlag from "@modules/layout/components/effect-budget-flag"
import ScrollResetOnRoute from "@lib/helpers/scrollResetOnRoute"
import SessionVersionWatch from "@modules/layout/components/session-version"
import { bootResetScript } from "@lib/util/session-version"
import { StateProvider } from "@lib/context/StateContext"
import { getBaseURL } from "@lib/util/env"
import CookieNotice from "@modules/layout/CookieNotice"
import Analytics from "@modules/analytics"
import {
  consentDefaultScript,
  gaMeasurementId,
} from "@modules/analytics/consent-mode"
import { Metadata } from "next"
import { getLegalFacts } from "@lib/data/legal-facts"
import { LegalFactsProvider } from "@lib/legal/facts-context"
import "styles/globals.scss"
import StudioClient from "@c3studium/valecms/manage/appClient.jsx";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  // Every page inherits the brand suffix; pages that are the brand itself opt out
  // with `title: { absolute: … }`.
  title: {
    default: "Keramická zahrada | Autorská keramika Lucie Polanské",
    template: "%s | Keramická zahrada",
  },
  description:
    "Ručně tvořená keramika pro zahradu i domov z píseckého ateliéru Lucie Polanské. Hotové kusy, zakázková výroba i keramické kurzy.",
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
    <html lang="cs" data-mode="light">
      <body>
        {/* Úklid po předchozí verzi obchodu. Musí běžet dřív než cokoli
            jiného na stránce, proto je to vložený skript a ne komponenta:
            aplikace se tak nikdy nedostane ke stavu po verzi, která už
            neběží. Viz `@lib/util/session-version`. */}
        {uklidPoStareVerzi ? (
          <script dangerouslySetInnerHTML={{ __html: uklidPoStareVerzi }} />
        ) : null}
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
        <StudioClient />
      </body>
    </html>
  )
}
