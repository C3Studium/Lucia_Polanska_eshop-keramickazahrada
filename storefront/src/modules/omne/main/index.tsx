"use client"

import {
    easeInOut,
    motion,
    useMotionValue,
    useScroll,
    useTransform,
} from "framer-motion"

import { heroBeat, heroReveal } from "@lib/motion-tokens"
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { shaderImages } from "@lib/util/site-copy";
import type { CopyBlock } from "@lib/util/site-copy";
import {
    growEase,
    storySteps,
    StoryCopyVisual,
    StoryImageVisual,
    STORY_OFFSET,
} from "@modules/omne/story";
import AboutHeroShader, { aboutImages } from "./AboutHeroShader";
import { palette } from "styles/palette.generated";

/*
 * ─── Předání do příběhu, zrcadlově k výrobě ─────────────────────────────────
 *
 * Hero jede v připnuté timeline jako úvod výroby: v druhé půlce scrollu
 * potemní do uhelné místnosti příběhu, portrét vpravo doroste PŘESNĚ do desky
 * scény `AboutStory` (kotva `right`, otevírá se doleva — výroba kotví vlevo
 * a otevírá se doprava) a vedle něj se vynoří text první kapitoly. Příběh je
 * pod hero podtažený záporným marginem, takže když se scéna na konci
 * rozplyne, stojí pod ní tentýž snímek a kapitoly plynule navážou.
 *
 * Platí to pro počítač i pro svislý telefon — tam jen deska doroste přes celý
 * rám místo do sloupce vedle textu. Žádná větev v JS to neřídí: koncová
 * geometrie jsou `--story-plate-*` proměnné publikované v story/styles.scss
 * i pro `.aboutMe__sticky`, a stopy je přepisují na svém místě. Start čte
 * tytéž `--hero-portrait-*` proměnné jako portrét sám.
 *
 * Obě strany každé interpolace nesou stejný tvar calc() řetězce — framer pak
 * interpoluje jen čísla v něm (stejný trik jako `* 1` v úvodu výroby).
 */
const GROW: [number, number] = [0.42, 0.99]
/** Šířka portrétu = výška × poměr stran karty (297/410). */
const PORTRAIT_ASPECT = (297 / 410).toFixed(4)

/*
 * Scroll je lineární vstup — plynulost dělají křivky. `growEase` (křivka
 * dosedající desky) je importovaná ze story, ne opsaná: telefonní růst v sekci
 * a tenhle v hero jsou tentýž pohyb a dvě kopie by se rozešly. Stmívání
 * a odchody obsahu nesou obyčejné easeInOut.
 */
const fadeEase = easeInOut

/*
 * ─── Barevná dráha závoje ───────────────────────────────────────────────────
 *
 * Cíl: hero (sage) → uhelná místnost příběhu, aniž by prostředek cesty vyšel
 * mrtvě šedý a aniž by tmavnutí někde „utíkalo".
 *
 * Barva jde přes olivovou — tentýž mezitón, jakým výroba pouští uhelnou
 * galerii zpět do sage (`Gallery__outro`), jen obráceně. Průhlednost se ale
 * NEINTERPOLUJE spolu s ní: vnímaný jas totiž neklesá stejnoměrně jako alfa
 * (kompozice nad světlým podkladem není lineární) a stupňovitá interpolace
 * navíc easuje každý úsek zvlášť — naměřený dvojitý puls se skokem 32 jednotek
 * jasu v jednom kroku scrollu. Místo toho se z požadovaného jasu alfa DOPOČTE,
 * takže jas klesá rovnoměrně a tvar dodá jediná křivka nad celým oknem.
 */
const rgbOf = (hex: string): [number, number, number] => {
    const value = parseInt(hex.slice(1), 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
/** Vnímaný jas (Rec. 709) — váhy, kterými oko skládá kanály. */
const lumOf = ([r, g, b]: [number, number, number]) =>
    0.2126 * r + 0.7152 * g + 0.0722 * b

const VEIL_FROM = rgbOf(palette.olive13)
const VEIL_TO = rgbOf(palette.ink05)
const GROUND_LUM = lumOf(rgbOf(palette.sage01))
const TARGET_LUM = lumOf(VEIL_TO)

const veilAt = (t: number): string => {
    const color = VEIL_FROM.map(
        (from, i) => from + (VEIL_TO[i] - from) * t
    ) as [number, number, number]
    /* Kolik krytí je potřeba, aby složený obraz měl právě tenhle jas. */
    const wanted = GROUND_LUM + (TARGET_LUM - GROUND_LUM) * t
    const reach = GROUND_LUM - lumOf(color)
    const alpha = reach <= 0 ? 1 : Math.min(1, (GROUND_LUM - wanted) / reach)

    return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(
        color[2]
    )}, ${alpha.toFixed(4)})`
}

export default function AboutMe ({ block }: { block?: CopyBlock }) {
    // Shader/cursor reduced-motion fallback is intentionally disabled for now.
    // const reduceMotion = useReducedMotion()
    const pointerX = useMotionValue(0)
    const pointerY = useMotionValue(0)

    const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "touch") return
        const bounds = event.currentTarget.getBoundingClientRect()
        pointerX.set((event.clientX - bounds.left) / Math.max(bounds.width, 1) - .5)
        pointerY.set((event.clientY - bounds.top) / Math.max(bounds.height, 1) - .5)
    }

    const resetPointer = () => {
        pointerX.set(0)
        pointerY.set(0)
    }

    /* Fotka 1. kapitoly příběhu (o-mne.galerie, za dvojicí shaderu) — tentýž
       snímek, který pak stojí ve scéně; konec růstu je tak jeden obraz, ne
       střih. */
    const storyPhoto = block?.gallery?.[STORY_OFFSET]
    const previewStep = {
        ...storySteps[0],
        src: storyPhoto?.url ?? storySteps[0].src,
        alt: storyPhoto?.alt?.trim() || storySteps[0].alt,
    }
    /* A druhá fotka bloku je portrét, který kreslí shader — tím růst začíná,
       aby i první šev byl jeden obraz. Táž cesta, jakou ji bere hero (viz
       `shaderImages` níž), včetně zálohy z kódu. */
    const heroPortrait = shaderImages(block, aboutImages)[1].src

    const timelineRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: timelineRef,
        offset: ["start start", "end end"],
    })

    /*
     * Předání běží tam, kde je scéna příběhu podtažená pod hero: na šířku od
     * 760 px a na svislých telefonech. Mezi tím (telefon naležato, tablet
     * nastojato) jede hero obyčejným tokem a příběh naskládaným seznamem —
     * tam by se stmívání pověsilo na timeline, která nemá žádnou dráhu.
     *
     * Dotaz musí sedět na stopy ve stylech, jinak by se JS a CSS rozešly:
     * `from-px(760px)` plus `v(xs)` omezené `v(md)` v main/styles.scss.
     */
    const [handoff, setHandoff] = useState(false)

    useEffect(() => {
        const query = window.matchMedia(
            "(min-width: 760px) and (orientation: landscape), (orientation: portrait) and (max-width: 599.98px)"
        )
        const sync = () => setHandoff(query.matches)

        sync()
        query.addEventListener("change", sync)
        return () => query.removeEventListener("change", sync)
    }, [])

    /* Odchody hero obsahu — na obalech bez vlastních CSS animací: aboutCopyIn
       s `fill: both` by na svém prvku přebil inline opacity navždy. */
    const copyOpacity = useTransform(scrollYProgress, [0.1, 0.38], [1, 0], {
        ease: fadeEase,
    })
    const copyY = useTransform(scrollYProgress, [0.1, 0.38], [0, -36], {
        ease: fadeEase,
    })
    const chapterOpacity = useTransform(scrollYProgress, [0.1, 0.32], [1, 0], {
        ease: fadeEase,
    })
    /*
     * Výměna portrétu za rostoucí desku — a to DŘÍV, než začne stmívání.
     *
     * Portrét kreslí shader (canvas pod závojem), kdežto proxy stojí nad ním,
     * takže jakmile jednou závoj běží, prolnutí by znamenalo naskočení jasné
     * fotky přes už setmělou: naměřeno na 0.45–0.50 skok krytí 0.03 → 0.87
     * proti závoji s alfou 0.55. Obě fotky jsou tentýž snímek na tomtéž místě,
     * takže na nesetmělém podkladu je výměna neviditelná — a od té chvíle
     * místnost tmavne kolem fotky, která zůstává svítit. To je i koncový stav.
     *
     * Rámeček karty (stín, rohy, popisek) odchází v témže okně, aby popisek
     * nesvítil dvakrát.
     */
    const swap: [number, number] = [0.16, 0.26]
    const portraitOpacity = useTransform(scrollYProgress, swap, [1, 0], {
        ease: fadeEase,
    })
    /*
     * Stmívání do uhelné místnosti příběhu — dlouhé okno, jediná křivka nad
     * ním a barva dopočítaná tak, aby jas klesal rovnoměrně (viz `veilAt`).
     */
    const veilProgress = useTransform(scrollYProgress, [0.24, 0.74], [0, 1], {
        ease: fadeEase,
    })
    const veilColor = useTransform(veilProgress, veilAt)
    /* Žhavý odlesk scény (clay .05) přichází s barvou, ne skokem — poslední
       snímek hero pak sedí na scéně pod ním i tímhle detailem. */
    const veilGlowOpacity = useTransform(scrollYProgress, [0.5, 0.74], [0, 1], {
        ease: fadeEase,
    })
    const proxyOpacity = useTransform(scrollYProgress, swap, [0, 1], {
        ease: fadeEase,
    })

    const proxyTop = useTransform(
        scrollYProgress,
        GROW,
        [
            "calc(100% - var(--hero-portrait-bottom) * 1 - var(--hero-portrait-h) * 1 + var(--story-plate-top) * 0)",
            "calc(0% - var(--hero-portrait-bottom) * 0 - var(--hero-portrait-h) * 0 + var(--story-plate-top) * 1)",
        ],
        { ease: growEase }
    )
    const proxyRight = useTransform(
        scrollYProgress,
        GROW,
        [
            "calc(var(--hero-portrait-right) * 1 + var(--story-plate-right) * 0)",
            "calc(var(--hero-portrait-right) * 0 + var(--story-plate-right) * 1)",
        ],
        { ease: growEase }
    )
    const proxyWidth = useTransform(
        scrollYProgress,
        GROW,
        [
            `calc(var(--hero-portrait-h) * ${PORTRAIT_ASPECT} + var(--story-plate-w) * 0)`,
            `calc(var(--hero-portrait-h) * 0 + var(--story-plate-w) * 1)`,
        ],
        { ease: growEase }
    )
    const proxyHeight = useTransform(
        scrollYProgress,
        GROW,
        [
            "calc(var(--hero-portrait-h) * 1 + var(--story-plate-h) * 0)",
            "calc(var(--hero-portrait-h) * 0 + var(--story-plate-h) * 1)",
        ],
        { ease: growEase }
    )
    /* Rohy karty se narovnají do desky; radius je schválně v px (viz
       --hero-radius) a nad 760 px se nemění, takže start je konstanta. */
    const proxyRadius = useTransform(scrollYProgress, GROW, ["20px", "0px"], {
        ease: growEase,
    })
    const proxyImageScale = useTransform(scrollYProgress, GROW, [1.08, 1.045], {
        ease: growEase,
    })
    const proxyImageY = useTransform(scrollYProgress, GROW, ["0%", "2.8%"], {
        ease: growEase,
    })

    /*
     * Přebal hero fotky na fotku kapitoly — uprostřed růstu, ne na jeho
     * začátku, a přebalem, ne prolnutím.
     *
     * Jsou to dva různé soubory (viz `from` v StoryImageVisual), takže
     * prolnutí přes průhlednost dělalo dvojexpozici — dvě hlavy přes sebe.
     * Svislý přebal je přitom vlastní řeč téhle scény: přesně tak se odkrývá
     * každá další kapitola (`ImageLayer`). Načasováno do místa, kde deska letí
     * nejrychleji (naměřený vrchol dráhy ~0.70), takže splyne s pohybem.
     */
    const proxyImageClip = useTransform(
        scrollYProgress,
        [0.6, 0.8],
        ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"],
        { ease: fadeEase }
    )
    /* Hero portrét kreslí shader plným výřezem (cover bez přiblížení). Vnitřní
       vrstva má `inset: -3%`, tedy 106 % boxu — zpětné 1/1.06 ji na začátku
       srovná přesně na to, co canvas pod ní kreslí, aby výměna nepodklouzla.
       Ke konci přebalu už doráží na dráhu fotky kapitoly. */
    const fromScale = useTransform(scrollYProgress, GROW, [1 / 1.06, 1.02], {
        ease: growEase,
    })
    /* Popisek desky přichází až s růstem — během výměny fotky by se překrýval
       s popiskem karty portrétu („Ateliér · Písek" na tomtéž rohu). */
    const proxyCaptionOpacity = useTransform(
        scrollYProgress,
        [0.3, 0.46],
        [0, 1],
        { ease: fadeEase }
    )

    const previewCopyOpacity = useTransform(
        scrollYProgress,
        [0.66, 0.92],
        [0, 1],
        { ease: fadeEase }
    )
    /* Ve vh, ne ve výrobních px: scéna pod tímhle náhledem drží svůj text na
       ~1.4vh (progress ~0.013 při rozplynutí hero) a px konec dělal při
       prolnutí ~6px dvojitou expozici. Dráha jede po křivce růstu, aby text
       dosedal spolu s deskou. */
    const previewCopyY = useTransform(
        scrollYProgress,
        [0.66, 0.94],
        ["4.7vh", "1.4vh"],
        { ease: growEase }
    )
    const previewCopyClip = useTransform(
        scrollYProgress,
        [0.66, 0.94],
        ["inset(10% 0% 0% 0%)", "inset(0% 0% 0% 0%)"],
        { ease: growEase }
    )

    const handoffOpacity = useTransform(scrollYProgress, [0.96, 1], [1, 0])
    const handoffPointerEvents = useTransform(scrollYProgress, (progress) =>
        progress >= 0.985 ? "none" : "auto"
    )

    return (
        <section
            className="AboutMe"
            id="about-intro"
            data-scroll-section
            data-scroll-label="Představení"
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
        >
            <div ref={timelineRef} className="aboutMe__timeline">
                <motion.div
                    className="aboutMe__sticky"
                    style={{
                        opacity: handoff ? handoffOpacity : 1,
                        pointerEvents: handoff ? handoffPointerEvents : "auto",
                    }}
                >
                    <div className="aboutMe__frame">
                        <motion.div
                            className="aboutHeroShaderStage"
                            initial={initial}
                            animate={animate}
                            transition={transition}
                        >
                            {/* První dvě fotky bloku `o-mne.galerie`; další dvě nese
                                příběh níž (viz STORY_OFFSET v omne/story). */}
                            <AboutHeroShader
                                pointerX={pointerX}
                                pointerY={pointerY}
                                imageSet={shaderImages(block, aboutImages)}
                            />
                        </motion.div>
                        <motion.p
                            className="about__eyebrow"
                            variants={heroReveal}
                            initial="hidden"
                            animate="show"
                            custom={heroBeat.eyebrow}
                        >
                            O mně · keramická zahrada
                        </motion.p>
                        <motion.div
                            className="Text__content"
                            style={handoff ? { opacity: copyOpacity, y: copyY } : undefined}
                        >
                            <div className="image__intro">
                                <motion.div
                                    className="image__wrapper"
                                    initial={{ clipPath: "inset(0 100% 0 0 round 20px)" }}
                                    animate={{ clipPath: "inset(0 0% 0 0 round 20px)" }}
                                    transition={transition2}
                                />
                                <motion.div
                                    className="about__imageMeta"
                                    aria-hidden="true"
                                    variants={heroReveal}
                                    initial="hidden"
                                    animate="show"
                                    custom={heroBeat.heading}
                                >
                                    <span>Ručně tvořeno</span>
                                    <i />
                                    <span>Písek · od roku 2014</span>
                                </motion.div>
                                <h1>
                                    <motion.span
                                        variants={heroReveal}
                                        initial="hidden"
                                        animate="show"
                                        custom={heroBeat.heading}
                                    >
                                        Jmenuji se
                                    </motion.span>
                                    <motion.span
                                        className="handwritten"
                                        variants={heroReveal}
                                        initial="hidden"
                                        animate="show"
                                        custom={heroBeat.lede}
                                    >
                                        Lucie Polanská
                                    </motion.span>
                                </h1>
                            </div>
                            <motion.div
                                className="greetings"
                                variants={heroReveal}
                                initial="hidden"
                                animate="show"
                                custom={heroBeat.action}
                            >
                                <span className="greetings__icon" aria-hidden="true">
                                    <motion.span
                                        animate={animate2}
                                        transition={transition3}
                                    >
                                        <Image src="/assets/icons/wawing_hand.png" alt="" width={78} height={78}/>
                                    </motion.span>
                                </span>
                                <p>
                                    Těší mě
                                </p>
                                <span className="greetings__line" aria-hidden="true" />
                            </motion.div>
                        </motion.div>
                        <motion.div
                            className="Images__content"
                            initial={{ clipPath: "inset(100% 0 0 0 round 20px)" }}
                            animate={{ clipPath: "inset(0% 0 0 0 round 20px)" }}
                            transition={transition4}
                            style={handoff ? { opacity: portraitOpacity } : undefined}
                        >
                            <span className="portrait__caption">
                                Ateliér · Písek
                            </span>
                        </motion.div>
                        <motion.div
                            className="about__chapterTransition"
                            aria-label="Začátek kapitoly Můj příběh"
                            style={handoff ? { opacity: chapterOpacity } : undefined}
                        >
                            <span>01</span>
                            <i aria-hidden="true" />
                            <span>Můj příběh</span>
                        </motion.div>

                        <motion.figure
                            className="aboutMe__storyProxy aboutStory__image"
                            aria-hidden="true"
                            style={{
                                opacity: proxyOpacity,
                                top: proxyTop,
                                right: proxyRight,
                                width: proxyWidth,
                                height: proxyHeight,
                                borderRadius: proxyRadius,
                                left: "auto",
                                bottom: "auto",
                            }}
                        >
                            <StoryImageVisual
                                item={previewStep}
                                imageStyle={{
                                    scale: proxyImageScale,
                                    y: proxyImageY,
                                    clipPath: proxyImageClip,
                                }}
                                sizes="58vw"
                                from={{
                                    src: heroPortrait,
                                    style: { scale: fromScale },
                                }}
                                captionStyle={{ opacity: proxyCaptionOpacity }}
                            />
                        </motion.figure>
                    </div>

                    <motion.div
                        className="aboutMe__veil"
                        style={{ backgroundColor: veilColor }}
                        aria-hidden="true"
                    >
                        <motion.i style={{ opacity: veilGlowOpacity }} />
                    </motion.div>

                    <div
                        className="aboutMe__storyCopyStage aboutStory__copyStage"
                        aria-hidden="true"
                    >
                        {/* Náhled 1. kapitoly — tytéž texty jako ve scéně níž,
                            takže předání je tentýž snímek. */}
                        <motion.article
                            className="aboutStory__copy"
                            style={{
                                opacity: previewCopyOpacity,
                                y: previewCopyY,
                                clipPath: previewCopyClip,
                            }}
                        >
                            <StoryCopyVisual item={previewStep} />
                        </motion.article>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0 }
const animate = { opacity: 1 }
const transition = { duration: .7, delay: .55, ease: [.22, 1, .36, 1] as [number, number, number, number] }
const transition2 = { duration: 1.15, ease: [.76, 0, .24, 1] as [number, number, number, number] }
const animate2 = { rotate: [0, 7, -3, 6, 0] }
const transition3 = { duration: 1.65, repeat: Infinity, repeatDelay: 4.2, ease: "easeInOut" as const }
const transition4 = { duration: 1, delay: .45, ease: [.76, 0, .24, 1] as [number, number, number, number] }
