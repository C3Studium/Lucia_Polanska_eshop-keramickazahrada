import IntroSection from "./Intro";
import Collections from "./Collections";
import Courses from "./Courses";

export default function ECom({
    settings,
    introData,
}: {
    settings?: any
    introData?: any
}) {
    const ecomEnabled = settings?.ecomSection?.enabled !== false;
    const introEnabled = settings?.ecomSection?.intro !== false;
    const entryEnabled = settings?.ecomSection?.entry !== false;

    if (!ecomEnabled) {
        return null;
    }

    return (
        <section className="home__ecom">
            {introEnabled && <IntroSection data={introData} />}
            {entryEnabled && <Collections />}
            <Courses />
        </section>
    )
}
