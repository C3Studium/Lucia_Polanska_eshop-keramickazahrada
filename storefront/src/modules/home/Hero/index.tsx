import IntroHero from "./IntroHero";

export default function HeroSection({
    settings,
    introHero,
    newsText,
}: {
    settings?: any
    introHero?: any
    newsText?: string
}) {
    const heroEnabled = settings?.heroSection?.enabled !== false;
    const introHeroEnabled = settings?.heroSection?.introHero !== false;

    if (!heroEnabled) {
        return null;
    }

    return (
        <section
            id="home-atelier"
            data-scroll-section
            data-scroll-label="Ateliér"
        >
            {introHeroEnabled && <IntroHero data={introHero} newsText={newsText} />}
        </section>
    )
}
