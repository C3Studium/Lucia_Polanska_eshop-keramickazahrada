import type { CopyBlocks } from "@lib/util/site-copy"
import { button, sectionEnabled } from "@lib/util/site-copy"
import type { Notice } from "@lib/util/notices"
import IntroHero from "./IntroHero";

/**
 * Hero úvodní stránky.
 *
 * Přepínače sekcí přišly dřív ze Sanity jako zanořený objekt
 * (`settings.heroSection.enabled`); v CMS jsou to řádky bloku `index.sections`
 * s tečkovaným popiskem, protože zanořený JSON v textovém poli nikdo neupraví.
 * `sectionEnabled` je čte a chybějící hodnotu bere jako zapnuto — nový web má
 * všechno vidět, dokud někdo vědomě neřekne jinak.
 */
export default function HeroSection({
    copy,
    notices = [],
}: {
    copy: CopyBlocks
    notices?: Notice[]
}) {
    const sections = copy["index.sections"]

    if (!sectionEnabled(sections, "heroSection.enabled")) {
        return null;
    }

    return (
        <section
            id="home-atelier"
            data-scroll-section
            data-scroll-label="Ateliér"
        >
            {sectionEnabled(sections, "heroSection.introHero") && (
                <IntroHero
                    block={copy["index.hero"]}
                    notices={notices}
                    // Tlačítko je vlastní dokument, ne pole bloku — tentýž
                    // „Prohlédnout výrobky" stojí na čtyřech místech webu.
                    cta={button(copy, "index.hero")}
                />
            )}
        </section>
    )
}
