"use client"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import { editable, editableSet } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock, FaqCategory, FaqQuestion } from "@lib/util/site-copy"
import { shaderImages } from "@lib/util/site-copy"
import FAQBody from "@modules/dotazy/FAQ"
import { motion, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion"
import { useRef, type PointerEvent } from "react"
import FAQImageShader, { faqImages } from "./FAQImageShader"
import { alpha, palette } from "styles/palette.generated"

export default function DotazyMain ({
    block,
    texts,
    hero,
    cmsQuestions,
    cmsCategories,
}: {
    /** `dotazy.galerie` — fotky shaderu i u kontaktní výzvy. */
    block?: CopyBlock
    /** `dotazy.otazky` — znění otázek a odpovědí + texty kolem seznamu. */
    texts?: CopyBlock
    /** `dotazy.hero` — texty úvodní obrazovky. */
    hero?: CopyBlock
    /** Dokumenty typu `qna` — otázky, jedna = jeden dokument. */
    cmsQuestions?: FaqQuestion[]
    /** Dokumenty `qnaKategorie` — čipy filtru. */
    cmsCategories?: FaqCategory[]
}) {
    /* Stránka se hýbe jen hodnotami ze scrollu — bez tohohle by se po zapnutí režimu
       editace nepřekreslila a `editable()` by zůstalo prázdné. Viz hook. */
    useEditRerender()

    const railLeft = hero?.accent?.[0]?.trim() || "Pomoc & informace"
    const railRight = hero?.accent?.[1]?.trim() || "Ateliér Lucie Polanské · 01"
    const kicker = hero?.accent?.[2]?.trim() || "Nejčastější otázky · 01"
    const ctaText = hero?.accent?.[3]?.trim() || "Přejít na odpovědi"
    const scrollCue = hero?.accent?.[4]?.trim() || "Pokračovat"
    const titleLead = hero?.title?.trim() || "Zeptejte se"
    const titleAccent = hero?.headline?.trim() || "na cokoliv."
    const lede =
        hero?.bodyText?.trim() ||
        "Objednávky, péče o keramiku, zakázková výroba i kurzy — všechno na jednom místě."

    const heroRef = useRef<HTMLDivElement>(null)
    // Shader/cursor reduced-motion fallback is intentionally disabled for now.
    // const reduceMotion = useReducedMotion()
    const pointerX = useMotionValue(0)
    const pointerY = useMotionValue(0)
    const cursorX = useSpring(pointerX, { stiffness: 105, damping: 15, mass: 0.42 })
    const cursorY = useSpring(pointerY, { stiffness: 105, damping: 15, mass: 0.42 })
    const glowX = useTransform(cursorX, [-0.5, 0.5], ["54%", "74%"])
    const glowY = useTransform(cursorY, [-0.5, 0.5], ["34%", "68%"])
    const heroLight = useMotionTemplate`radial-gradient(circle at ${glowX} ${glowY}, ${alpha("cream06", 0.34)} 0%, ${alpha("cream06", 0.14)} 24%, ${alpha("cream06", 0)} 58%)`
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"],
    })
    const progress = useSpring(scrollYProgress, {
        stiffness: 110,
        damping: 28,
        mass: 0.35,
    })

    const scrollToAnswers = (event: React.MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault()
        const answers = document.getElementById("faq-section-title")
        if (answers) {
            scrollWithLenis(answers)
            window.history.replaceState(null, "", "#faq-section-title")
        }
    }

    const faqTimeline = [0, 0.16, 0.58, 0.88, 1]
    const faqX = useTransform(progress, faqTimeline, ["0vw", "0vw", "6vw", "14vw", "14vw"])
    const faqY = useTransform(progress, faqTimeline, ["0vh", "0vh", "28vh", "97vh", "97vh"])
    const faqScale = useTransform(progress, faqTimeline, [1, 1, 0.86, 0.62, 0.62])
    const faqRotate = useTransform(progress, faqTimeline, [0, 0, -1.2, 0, 0])
    const faqTracking = useTransform(progress, faqTimeline, ["-0.075em", "-0.075em", "-0.065em", "-0.045em", "-0.045em"])
    const faqOpacity = useTransform(progress, [0, 0.84, 1], [1, 1, 0.68])
    const faqParallaxY = useTransform(scrollYProgress, [0, 1], [0, 150])
    const faqCursorX = useTransform(cursorX, (value) => value * -10)
    const faqCursorY = useTransform(cursorY, (value) => value * -7)
    const faqComposedX = useMotionTemplate`calc(${faqX} + ${faqCursorX}px)`
    const faqComposedY = useMotionTemplate`calc(${faqY} + ${faqParallaxY}px + ${faqCursorY}px)`

    const heroChromeOpacity = useTransform(progress, [0, 0.46, 0.74], [1, 1, 0])
    const heroChromeY = useTransform(progress, [0, 0.74], [0, -18])

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "touch") return

        const bounds = event.currentTarget.getBoundingClientRect()
        pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5)
        pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5)
    }

    const resetPointer = () => {
        pointerX.set(0)
        pointerY.set(0)
    }

    return (
        <section
            className="DotazyExperience"
            id="faq-intro"
            data-scroll-section
            data-scroll-label="Úvod"
        >
            <motion.div
                ref={heroRef}
                className="DotazyMain"
                onPointerMove={handlePointerMove}
                onPointerLeave={resetPointer}
                style={{ backgroundImage: heroLight }}
            >
                <motion.div
                    className="faqHeroMeta"
                    style={{ opacity: heroChromeOpacity, y: heroChromeY }}
                >
                    <motion.div
                        className="faqHeroMetaInner"
                        initial={initial}
                        animate={animate}
                        transition={transition}
                    >
                        <span {...editable(hero, "accent.0")}>{railLeft}</span>
                        <span {...editable(hero, "accent.1")}>{railRight}</span>
                    </motion.div>
                </motion.div>
                <motion.div
                    className="faqShaderStage"
                    initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
                    animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
                    transition={transition2}
                    style={{ opacity: heroChromeOpacity, y: heroChromeY }}
                >
                    {/* Textury shaderu z CMS. Bucket posílá CORS hlavičky
                        a `THREE.TextureLoader` si `crossOrigin` nastavuje sám,
                        takže se načtou stejně jako soubory z `public/`.
                        Poměr stran jde s nimi — shader ho potřebuje dřív, než
                        se obrázek stáhne, jinak by karty po načtení poskočily.

                        Anotace je `editableSet` na celé sadě: fotky žijí ve WebGL
                        plátně, takže jednotlivě chytit nejdou — kliknutí na scénu
                        otevře editor celé „Sady obrázků" bloku `dotazy.galerie`,
                        odkud jdou vyměnit po jedné. */}
                    {/* Cíl pro editaci musí mít PLOCHU: holý div tu měl nulovou výšku
                        (karty shaderu se pozicují vůči scéně, ne vůči němu), takže anotace
                        byla, ale nebylo kam kliknout. Mimo editor je vrstva neklikatelná
                        jako celá scéna — atribut, na který míří globální pravidlo
                        `[data-cms-field] { pointer-events: auto }`, existuje jen v editoru. */}
                    <div
                        className="faqShaderEditTarget"
                        {...editableSet(block, "gallery")}
                    >
                        <FAQImageShader
                            pointerX={pointerX}
                            pointerY={pointerY}
                            imageSet={shaderImages(block, faqImages)}
                        />
                    </div>
                </motion.div>
                <motion.div
                    className="faqHeroCaption"
                    style={{ opacity: heroChromeOpacity, y: heroChromeY }}
                >
                    <motion.div
                        className="faqHeroCaptionInner"
                        initial={initial2}
                        animate={animate}
                        transition={transition3}
                    >
                        <span className="faqHeroKicker" {...editable(hero, "accent.2")}>
                            {kicker}
                        </span>
                        {/* The page started its outline at h2 — screen-reader users navigating
                            by heading landed nowhere. This is the page's h1.
                            Obě půlky vlastní pole — `editable` píše celé pole naráz. */}
                        <h1>
                            <span {...editable(hero, "title")}>{titleLead}</span>
                            <em {...editable(hero, "headline")}> {titleAccent}</em>
                        </h1>
                        <p {...editable(hero, "body")}>{lede}</p>
                        <a
                            href="#faq-section-title"
                            onClick={scrollToAnswers}
                            {...editable(hero, "accent.3")}
                        >
                            {ctaText}
                            <span aria-hidden="true">↓</span>
                        </a>
                    </motion.div>
                </motion.div>
                <motion.div
                    className="faqHeroScrollCue"
                    style={{ opacity: heroChromeOpacity }}
                    initial={initial3}
                    animate={animate2}
                    transition={transition4}
                    aria-hidden="true"
                >
                    <span {...editable(hero, "accent.4")}>{scrollCue}</span>
                    <i />
                </motion.div>
            </motion.div>

            {/* Decorative scroll-driven wordmark, not the page's heading — it was an h1,
                which is why the caption below had to start at h2. */}
            <motion.p
                aria-hidden="true"
                className="travellingFAQ"
                initial={{ clipPath: "inset(0 100% 0 0)" }}
                animate={{ clipPath: "inset(0 0% 0 0)" }}
                transition={transition5}
                style={{ x: faqComposedX, y: faqComposedY, scale: faqScale, rotate: faqRotate, opacity: faqOpacity, letterSpacing: faqTracking }}
            >
                FAQ
            </motion.p>

            <FAQBody
                block={block}
                texts={texts}
                cmsQuestions={cmsQuestions}
                cmsCategories={cmsCategories}
            />
        </section>
    )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0, y: -10 }
const animate = { opacity: 1, y: 0 }
const transition = { delay: 0.12, duration: 0.65, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const transition2 = { delay: 0.14, duration: 1.05, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const initial2 = { opacity: 0, y: 14 }
const transition3 = { delay: 0.48, duration: 0.7, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const initial3 = { opacity: 0 }
const animate2 = { opacity: 1 }
const transition4 = { delay: 0.85, duration: 0.7 }
const transition5 = { delay: 0.28, duration: 0.9, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
