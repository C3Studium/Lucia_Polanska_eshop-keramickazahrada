"use client";
import { Easing, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useMemo, useRef } from "react";

import { easeReveal } from "@lib/motion-tokens";
import { useStateContext } from "@lib/context/StateContext";
import { paragraphs } from "@lib/util/site-copy";
import type { CopyBlock, CopyButton } from "@lib/util/site-copy";
import { editable } from "@c3studium/valecms/edit";
import WebButton from "@modules/common/components/Buttons/webButton";
import HeroImageShader from "./HeroImageShader";
import HeroNotices from "./HeroNotices";
import type { Notice } from "@lib/util/notices";

const maskedHidden = { y: "115%" }
const maskedRest = { y: "0%" }
const chromeInitial = { opacity: 0, y: 12 }
const chromeAnimate = { opacity: 1, y: 0 }
const signatureOrigin = { transformOrigin: "bottom center" } as const
const mediaInnerStyle = {
    width: "100%",
    height: "100%",
    position: "relative",
    transformOrigin: "center center",
} as const
const ledeInitial = { opacity: 0, y: 28 }
const ledeAnimate = { opacity: 1, y: 0 }
const ledeTransition = { duration: 0.9, delay: 0.9, ease: easeReveal }

const DEFAULT_CONTENT =
    "Za každým výrobkem je příběh\nKaždý výrobek tvořím ručně s respektem k materiálu, času i lidem.";

/*
 * The promise, and what follows it.
 *
 * Normally that is the block's first paragraph against the rest, which is what `paragraphs()`
 * hands over. The copy on this site currently arrives as ONE paragraph — the CMS body has no
 * block-level break in it — and giving the whole of it to the display type is what made the
 * lockup 986px tall inside an 886px band at 1920x1080, 710 inside 592 at 1366x768 and 552
 * inside 484 at 1220x660. The headline ran over the footer rail at every landscape size and
 * the lede, which is the composition's counterweight on the right, was empty.
 *
 * The author's own mannerism is the separator. The promise is written wrapped in ellipses —
 * "..za každým mým výrobkem je příběh.." — which is the same convention `headlineStripped`
 * below already knows about and already trims off the ends. Applied consistently it also says
 * where the promise ENDS: the first interior run of ellipsis. Everything after it is the lede.
 *
 * No interior run, or more than one paragraph, and nothing here changes.
 */
const ELLIPSIS_RUN = /\.{2,}|\u2026+/;

function splitPromise(lines: string[]): [string, string] {
    if (lines.length > 1) {
        return [lines[0], lines.slice(1).join(" ")];
    }

    const only = lines[0] ?? "";
    const body = only.replace(/^[.\u2026\s]+/, "");
    const at = body.search(ELLIPSIS_RUN);

    if (at <= 0) {
        return [only, ""];
    }

    return [
        body.slice(0, at),
        body
            .slice(at)
            .replace(ELLIPSIS_RUN, "")
            .replace(/(?:\.{2,}|\u2026+)\s*$/, "")
            .trim(),
    ];
}

/**
 * Breaks the headline into two or three display lines at word boundaries, so the lockup stays
 * a tight block instead of one long line that shrinks to fit.
 */
function splitIntoLines(text: string) {
    const words = text.split(/\s+/).filter(Boolean);

    if (words.length <= 2) {
        return [text];
    }

    const lineCount = words.length >= 6 ? 3 : 2;
    const perLine = Math.ceil(words.length / lineCount);

    return Array.from({ length: lineCount }, (_, index) =>
        words.slice(index * perLine, (index + 1) * perLine).join(" ")
    ).filter(Boolean);
}

export default function IntroHero({
    block,
    notices = [],
    cta,
}: {
    /** Blok `index.hero` z CMS; chybí-li, sekce se vykreslí se zálohami níž. */
    block?: CopyBlock
    /** Dovolená a novinka z administrace. Prázdné pole = pás se nevykreslí. */
    notices?: Notice[]
    /**
     * Tlačítko `index.hero`. Vede dovnitř webu, takže se z CMS bere jen název —
     * cíl `/store` je routa téhle aplikace a mění se s kódem, ne s obsahem.
     */
    cta?: CopyButton
}) {
    const { firstLoad } = useStateContext();
    const ref = useRef<HTMLElement>(null);
    const pointerX = useMotionValue(0);
    const pointerY = useMotionValue(0);
    // Shader/cursor reduced-motion fallback is intentionally disabled for now.
    // const reduceMotion = useReducedMotion();
    // Z CMS přichází hotová adresa v úložišti — žádný builder jako u Sanity,
    // kde se rozměr a kvalita skládaly do URL. Velikosti řeší `next/image`.
    const heroImage = block?.gallery?.[0]?.url ?? "/assets/img/img/2.jpg";

    /*
     * Krátké texty hera z CMS, s dosavadním zněním jako záložní hodnotou.
     *
     * `accent` je v `siteCopy` pole krátkých řetězců — přesně tři popisky, které
     * hero nese kolem nadpisu, takže je drží v pořadí, v jakém se čtou: obočí nad
     * lockupem, pak levá a pravá půlka horní lišty. `items` je dvojice, a proto v
     * něm sedí číslo a jeho popisek pohromadě: v editoru to je jeden řádek se
     * dvěma poli, ne dva nesouvisející texty.
     *
     * Záložní hodnoty tu nejsou z opatrnosti — dokud majitelka blok nevyplní,
     * vrací CMS prázdno a hero by mělo tři díry. S nimi vypadá stránka stejně
     * jako předtím a naplnění CMS je pak změna, ne oprava.
     */
    const eyebrow = block?.accent?.[0]?.trim() || "Keramika z píseckého ateliéru";
    const topLeft = block?.accent?.[1]?.trim() || "Autorská keramika";
    const topRight = block?.accent?.[2]?.trim() || "Písek · od roku 2014";
    const countIndex = block?.items?.[0]?.lead?.trim() || "01";
    const countLabel =
        block?.items?.[0]?.label?.trim() || "Ručně · pomalu · v malém počtu";
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"]
    });

    const localJourneyProgress = useSpring(scrollYProgress, {
        stiffness: 82,
        damping: 26,
        mass: 0.42,
        restDelta: 0.0005,
    });
    const journeyProgress = localJourneyProgress;
    // Text bloku je psaný po odstavcích. První je slib, takže se z něj stane
    // displejový nadpis; co následuje, zůstává tichým podtitulkem.
    //
    // Odstavce se čtou přes `paragraphs()`, tedy z `body` (autorské HTML), NE
    // přes `bodyText.split("\n")`. `plainText()` v CMS nahrazuje `</p>` mezerou,
    // takže `bodyText` nikdy žádné zalomení nemá: tohle vracelo jednu položku,
    // celý text bloku se stal displejovým nadpisem (naměřeno 986 px lockupu na
    // 1920 proti 886 px pásma) a `ledeText` bylo vždycky prázdné.
    const contentLines = (() => {
        const fromCms = paragraphs(block);
        return fromCms.length
            ? fromCms
            : DEFAULT_CONTENT.split("\n").map((line) => line.trim()).filter(Boolean);
    })();
    const [headlineSource, ledeText] = splitPromise(contentLines);
    // Authors write the promise as "..za každým mým výrobkem je příběh.." — the leading and
    // trailing ellipses are a body-copy mannerism that reads as a typo at display size.
    const headlineStripped = headlineSource.replace(/^[.\u2026\s]+|[.\u2026\s]+$/g, "");
    // Stripping the leading ellipsis leaves a lowercase first letter at display size.
    const headlineText =
        headlineStripped.charAt(0).toLocaleUpperCase("cs") + headlineStripped.slice(1);
    const headlineLines = splitIntoLines(headlineText);
    // Jméno a příjmení jsou v CMS dvě pole (`title` a `headline`), ne jedno —
    // hero je sází jako podpis a slepené by se nedaly rozdělit zpátky.
    const signature = [block?.title || "Lucie", block?.headline || "Polanská"]
        .filter(Boolean)
        .join(" ");

    /*
     * Slib pod nadpisem — vlastní pole, se `splitPromise` jako zálohou.
     *
     * Bydlel v `body` za výpustkou, tedy ve stejném poli jako nadpis. To ho dělalo
     * neupravitelným: `editable` píše vždycky CELÉ pole, takže označit šlo jen jednoho ze
     * dvou sourozenců — a byl to nadpis. V editoru se na slib nedalo kliknout.
     *
     * `accent.3` je jeho vlastní pole. Když je prázdné, spadne se zpátky na půlku `body`,
     * takže starý obsah nikde nezmizí a stránka se chová jako dřív.
     */
    const promise = block?.accent?.[3]?.trim() || ledeText;

    const y = useTransform(journeyProgress, [0, 1], ["-1.5%", "2.5%"]);
    const imageScale = useTransform(journeyProgress, [0, 1], [1.035, 1.09]);
    const nameY = useTransform(journeyProgress, [0, 0.7, 1], [0, -8, -34]);
    const nameScale = useTransform(journeyProgress, [0, 0.76, 1], [1, 0.99, 0.965]);
    const nameOpacity = useTransform(journeyProgress, [0, 0.82, 1], [1, 1, 0]);
    const contentOpacity = useTransform(journeyProgress, [0, 0.78, 1], [1, 1, 0]);
    const contentY = useTransform(journeyProgress, [0, 0.78, 1], [0, -4, -22]);
    const chromeOpacity = useTransform(journeyProgress, [0, 0.84, 1], [1, 1, 0]);
    // Parallax is driven by the hero's own scroll: over the first screenful the page-wide kiln
    // journey barely advances, so tying text depth to it made the effect invisible. The two
    // masses travel at different rates, which is what actually reads as depth.
    const headlineParallax = useTransform(localJourneyProgress, [0, 1], ["0%", "-16%"]);
    const ledeParallax = useTransform(localJourneyProgress, [0, 1], ["0%", "-6%"]);

    /* framer-motion reads `style` on every render; a fresh object each time forces it to
       re-bind these motion values. They never change identity, so the wrappers are memoised. */
    const chromeStyle = useMemo(() => ({ opacity: chromeOpacity }), [chromeOpacity])
    const nameStyle = useMemo(
        () => ({ y: nameY, scale: nameScale, opacity: nameOpacity }),
        [nameY, nameScale, nameOpacity]
    )
    const headlineStyle = useMemo(() => ({ y: headlineParallax }), [headlineParallax])
    const ledeStyle = useMemo(
        () => ({ opacity: contentOpacity, y: ledeParallax }),
        [contentOpacity, ledeParallax]
    )
    const mediaStyle = useMemo(() => ({ y, scale: imageScale }), [y, imageScale])

    const eyebrowTransition = useMemo(
        () => ({ duration: 0.65, delay: firstLoad ? 0.15 : 0.85 }),
        [firstLoad]
    )
    const railLateTransition = useMemo(
        () => ({ duration: 0.65, delay: firstLoad ? 0.35 : 1.2 }),
        [firstLoad]
    )
    const railEarlyTransition = useMemo(
        () => ({ duration: 0.65, delay: firstLoad ? 0.3 : 1.1 }),
        [firstLoad]
    )

    // const PreloaderAnimSVG = {
    //     start: {
            
            
    //     },
    //     enter: {
            
    //         transition: {
    //             duration: 0.75,
    //             delay: firstLoad ? 2 : 0,
    //             ease: [0.76, 0, 0.24, 1],
    //         }
    //     }
    // }
    const PreloaderAnimImage = {
        initial: {
            blur: "10px",
        },
        start: {
            blur: "10px",
            transition: {
                duration: 0.75,
                delay: 0.25,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        },
        enter: {
            blur: "0px",
            transition: {
                duration: 0.75,
                delay: !firstLoad ? 0.25 : 0,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }
    const PreloaderAnimImage2 = {
        initial: {
            clipPath: "inset(0 0 100% 0)",
            scale: 1.06,
        },
        start: {
            clipPath: "inset(0 0 100% 0)",
            scale: 1.06,
            transition: {
                duration: 1.1,
                delay: 0.25,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        },
        enter: {
            clipPath: "inset(0 0 0% 0)",
            scale: 1,
            transition: {
                duration: 1.1,
                delay: !firstLoad ? 0.25 : 0,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }
    const PreloaderAnimUpdates = {
        initial: {
            y: "100%",
        },
        start: {
            y: "100%",
        },
        enter: {
            y: "0%",
            transition: {
                duration: 0.75,
                delay: !firstLoad ? 1.25 : 0,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }
    // const PreloaderAnimButton = {
    //     initial: {
    //         opacity: 0,
    //         y: 20,
    //     },
    //     start: {
    //         opacity: 0,
    //         y: 20,
    //     },
    //     enter: {
    //         opacity: 1,
    //         y: 0,
    //         transition: {
    //             duration: 0.5,
    //             delay: !firstLoad ? 1.35 : 0.5,
    //             ease: [0.76, 0, 0.24, 1] as Easing,
    //         }
    //     }
    // }

    return (
        <section
          className="Hero__Intro__Journey"
          ref={ref}
        >
          <div
            className="Hero__Intro"
            onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                pointerX.set((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5);
                pointerY.set((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5);
            }}
            onPointerLeave={() => {
                pointerX.set(0);
                pointerY.set(0);
            }}
        >
            <motion.div
                className="Hero__Intro__Topline"
                initial={chromeInitial}
                animate={chromeAnimate}
                transition={eyebrowTransition}
                style={chromeStyle}
            >
                <span {...editable(block, "accent.1")}>{topLeft}</span>
                <span className="line" />
                <span {...editable(block, "accent.2")}>{topRight}</span>
            </motion.div>
            <div className="Hero__Intro__Img">
                {/* <motion.div 
                    className="Hero__Intro__Img__inner"
                    initial="initial"
                    animate="enter"
                    exit="exit"
                    variants={PreloaderAnimImage}
                    style={signatureOrigin}
                >
                    <Image 
                        src={"/assets/img/11.jpg"}
                        alt="Intro Image"
                        sizes="50dvw"
                        fill={true}
                    />
                </motion.div> */}
            </div>
            <motion.div
                className="Hero__Intro__Header"
                style={nameStyle}
            >
                <div className="Hero__Intro__Lockup">
                <span className="Hero__Intro__Eyebrow" {...editable(block, "accent.0")}>{eyebrow}</span>

                {/* One h1, and it carries the promise rather than the name: a visitor arrives
                    looking for ceramics, not for a person. The first paragraph of the block's
                    text is the headline, so Lucia still edits it; the rest becomes the lede.
                    Proto je `editable` na celém `body` — obojí je jedno pole. */}
                <motion.h1
                    className="Hero__Intro__Headline"
                    style={headlineStyle}
                    {...editable(block, "body")}
                >
                    {headlineLines.map((line, index) => (
                        <MaskedLine
                            key={line + index}
                            text={line}
                            delay={0.35 + index * 0.14}
                        />
                    ))}
                </motion.h1>

                <motion.p className="Hero__Intro__Signature" style={headlineStyle}>
                    <span {...editable(block, "title")}>
                        <MaskedLine text={`— ${signature}`} delay={0.35 + headlineLines.length * 0.14} />
                    </span>
                </motion.p>
                </div>

                <motion.div
                    className="Hero__Intro__Lede"
                    style={ledeStyle}
                    initial={ledeInitial}
                    animate={ledeAnimate}
                    transition={ledeTransition}
                >
                    {/* Vlastní pole, ne druhá půlka `body`.
                        `editable` píše VŽDY celé pole, takže dokud tahle věta bydlela v `body`
                        spolu s nadpisem, mohl být označený jen jeden z nich — a byl to nadpis.
                        Kliknutí na slib v editoru tedy nedělalo nic. `accent.3` je jeho vlastní
                        pole, takže jde upravit sám a nezávisle na nadpisu.
                        `ledeText` (rozdělený `body`) zůstává jako záloha, aby se nic neztratilo,
                        kdyby bylo pole prázdné. */}
                    {promise && <p {...editable(block, "accent.3")}>{promise}</p>}
                    {/* Anotace sedí na obalu, ne na `WebButton`: ten si vykresluje
                        vlastní vnitřek (maska, přejezd výplně) a datové atributy
                        by skončily na prvku, který se při animaci přepisuje.
                        Překryv potřebuje stabilní element. */}
                    <div
                        className="Hero__Intro__Header__Cta"
                        {...editable(cta, "label")}
                    >
                        <WebButton
                            href="/store"
                            title={cta?.label?.trim() || "Prohlédnout výrobky"}
                            Kind="Link"
                            tone="dark"
                        />
                    </div>
                </motion.div>
            </motion.div>
            <motion.div
                className="Hero__Intro__Image__wrapper"
            >
                <motion.div 
                    className="Hero__Intro__Cover"
                    initial="initial"
                    animate="enter"
                    exit="exit"
                    variants={PreloaderAnimImage}
                    style={mediaStyle}
                >
                    <motion.div
                        className="Hero__Intro__Cover__Image"
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        variants={PreloaderAnimImage2}
                        style={mediaInnerStyle}
                    >
                        {/* Fotka hero je první položka galerie bloku — proto
                            `gallery.0`, ne `image`. Obal, protože atributy musí
                            sedět na elementu, který překryv najde v DOM. */}
                        <div
                            className="Hero__Intro__Media__Editable"
                            {...editable(block, "gallery.0", "image")}
                        >
                            <HeroImageShader
                                src={heroImage}
                                pointerX={pointerX}
                                pointerY={pointerY}
                            />
                        </div>
                        {/* Flat scrim over the whole frame. The wrapper's gradient handles the
                            edge the copy sits against, but on a phone the copy runs across the
                            middle of the picture too, where a gradient has already faded out. */}
                        <div className="Hero__Intro__Cover__Overlay" aria-hidden="true" />
                    </motion.div>
                </motion.div>
            </motion.div>
            <motion.div className="Hero__Intro__FooterRail" style={chromeStyle}>
                {/*
                  * Pás oznámení. Je tu jen tehdy, když je co oznámit.
                  *
                  * Dřív tu stál nápis „Dovolená | Novinky" pořád — i když dílna
                  * jela normálně a žádná novinka nebyla. Prázdný stav je většina
                  * roku, takže výchozí je nevykreslit nic; hero tím nic neztratí,
                  * protože pás nikdy nenesl vlastní sdělení.
                  *
                  * Data jdou z `getHeroNotices()` (nastavení obchodu v administraci
                  * přes `/store/shop-status`), takže se to zapíná a vypíná tam, kde
                  * majitelka dovolenou zadává — ne v CMS a ne v kódu.
                  */}
                {notices.length > 0 && (
                    <motion.div
                        className="Hero__Intro__Updates"
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        variants={PreloaderAnimUpdates}
                        custom={2}
                    >
                        <HeroNotices notices={notices} />
                    </motion.div>
                )}
                <motion.div
                    className="Hero__Intro__ScrollCue"
                    initial={chromeInitial}
                    animate={chromeAnimate}
                    transition={railLateTransition}
                >
                    <span>Pokračovat</span>
                    <i aria-hidden="true" />
                </motion.div>
                <motion.div
                    className="Hero__Intro__ObjectCount"
                    initial={chromeInitial}
                    animate={chromeAnimate}
                    transition={railEarlyTransition}
                >
                    <span {...editable(block, "items.0.lead")}>{countIndex}</span>
                    <span {...editable(block, "items.0.label")}>{countLabel}</span>
                </motion.div>
            </motion.div>
          </div>
        </section>
    )
}


/**
 * One headline line, revealed from behind a mask. Replaces the per-character fade: characters
 * were inline-block spans, which collapsed spaces and read as a shimmer rather than a reveal.
 * A masked line is the site's own clip-reveal language and arrives as one considered movement.
 */
function MaskedLine({
    text,
    delay = 0,
    className,
}: {
    text: string
    delay?: number
    className?: string
}) {
    const reduceMotion = useReducedMotion()

    const transition = useMemo(
        () => ({
            duration: reduceMotion ? 0 : 1.05,
            delay: reduceMotion ? 0 : delay,
            ease: easeReveal,
        }),
        [reduceMotion, delay]
    )

    return (
        <span className={`maskedLine ${className ?? ""}`}>
            <motion.span
                className="maskedLineInner"
                initial={reduceMotion ? maskedRest : maskedHidden}
                animate={maskedRest}
                transition={transition}
            >
                {text}
            </motion.span>
        </span>
    );
}

/* One `style` object and one variants object per *word* used to be allocated on every render of
   the hero. Both are now built once; only the per-word `custom` index still varies, which is a
   number and costs nothing. Timings are unchanged. */
const wordStyle = { display: "inline-block", whiteSpace: "pre", marginRight: "0.25rem" } as const
const breakWordStyle = { display: "inline-block", whiteSpace: "pre" } as const
const lineStyle = { display: "flex", flexWrap: "wrap" } as const

const buildWordVariants = (firstLoad: boolean) => ({
    start: { opacity: 0, y: 20 },
    enter: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            delay: !firstLoad ? 1.05 + i * 0.018 : 0.5 + i * 0.01,
            ease: easeReveal,
        },
    }),
})

/* Only two possible variant objects exist, so they are built once rather than per call. */
const wordVariants = {
    first: buildWordVariants(true),
    repeat: buildWordVariants(false),
} as const

const variantsFor = (firstLoad: boolean) =>
    firstLoad ? wordVariants.first : wordVariants.repeat

const wordSplit = (text: string, firstLoad: boolean) => {
    const variants = variantsFor(firstLoad)

    return text.split(' ').map((word, index) => (
        <motion.span
            key={index}
            initial="start"
            animate="enter"
            exit="exit"
            variants={variants}
            custom={index}
            style={wordStyle}
        >
            {word}
        </motion.span>
    ));
}

const textWithBreaks = (text: string, firstLoad: boolean) => {
    const variants = variantsFor(firstLoad)
    // Split once: this was re-split for every line to test for the last one.
    const lines = text.split('\n')

    return lines.map((line, lineIndex) => (
        <span key={lineIndex} style={lineStyle}>
            {line.split(' ').map((word, wordIndex) => (
                <motion.span
                    key={wordIndex}
                    initial="start"
                    animate="enter"
                    exit="exit"
                    variants={variants}
                    custom={lineIndex * 100 + wordIndex}
                    style={breakWordStyle}
                >
                    {word + " "}
                </motion.span>
            ))}
            {lineIndex < lines.length - 1 && <br />}
        </span>
    ));
}
