import type { CopyBlocks } from "@lib/util/site-copy";
import { sectionEnabled } from "@lib/util/site-copy";
import { listNavigationCollections } from "@lib/data/navigation";
import IntroSection from "./Intro";
import Collections from "./Collections";
import Courses from "./Courses";

/**
 * E-shopová část úvodní stránky.
 *
 * Kolekce a kurzy si data berou samy z Medusy — sem chodí jen redakční úvod.
 * Přepínače sekcí jsou řádky bloku `index.sections` (viz Hero/index.tsx).
 */
export default async function ECom({ copy }: { copy: CopyBlocks }) {
    const sections = copy["index.sections"]

    if (!sectionEnabled(sections, "ecomSection.enabled")) {
        return null;
    }

    /*
     * Kolekce z Medusy — jméno, odkaz a fotka.
     *
     * Tatáž funkce, jakou staví menu Produkty, takže kolekce se na úvodní stránce jmenují
     * a odkazují úplně stejně jako v navigaci. Dřív tu stálo šest vymyšlených kolekcí
     * natvrdo v komponentu a s katalogem se neshodovaly ani jménem.
     *
     * Nikdy nevyhodí: sekce bez kolekcí se prostě nevykreslí, což je lepší než rozbitá
     * úvodní stránka kvůli výpadku katalogu.
     */
    const collections = await listNavigationCollections().catch(() => [])

    return (
        <section className="home__ecom">
            {sectionEnabled(sections, "ecomSection.intro") && (
                <IntroSection block={copy["index.ecom-intro"]} copy={copy} />
            )}
            {sectionEnabled(sections, "ecomSection.entry") && (
                <Collections
                    block={copy["index.ecom-collections"]}
                    collections={collections}
                />
            )}
            {/* Celá mapa, ne jeden blok: Courses drží dvě tlačítka a obě si
                bere přes `button()` podle klíče. */}
            <Courses copy={copy} />
        </section>
    )
}
