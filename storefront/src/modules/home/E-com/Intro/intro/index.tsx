"use client";
import { useInView, motion, Easing } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { itemValue, paragraphs, type CopyBlock } from "@lib/util/site-copy";
import { editable } from "@c3studium/valecms/edit"

/*
 * Reveal choreography.
 *
 * Two things were wrong with the old timings. The observer fired at `amount: 0.05` with a -50px
 * margin, which on this 860px-tall chapter meant "5% of it has crossed the bottom of the window" —
 * about 700px before anyone can read a word of it. The whole reveal played out behind the hero and
 * the section was already settled by the time you scrolled to it. And every line started from
 * index 0 of its own charSplit, so the three lines of the headline fired simultaneously instead of
 * reading as one sentence.
 *
 * Now the trigger waits until the chapter's top has reached the lower third of the window, and the
 * lines run on a shared clock: each one starts before the previous has finished, so it reads as a
 * single continuous phrase rather than three separate reveals.
 */
const CHAR_STEP = 0.028
const WORD_STEP = 0.045
const LINE_LEAD = 0.16
const LINE_OVERLAP = 0.62 // fraction of a line's own length before the next one starts
const enterEase = [0.22, 1, 0.36, 1] as Easing

export default function Intro ({
    block,
    active,
}: {
    /** Blok `index.ecom-intro` z CMS. */
    block?: CopyBlock
    active?: boolean
}) {
    const ref = useRef<HTMLDivElement>(null);
    const observedInView = useInView(ref, {
        once: true,
        /* Shrink the viewport from the bottom instead of counting pixels of a section that is
           taller than the screen: the reveal starts when the chapter reaches ~70% down. */
        margin: "0px 0px -30% 0px",
        amount: 0.1,
    });
    const isInView = active ?? observedInView;

    // Tři řádky nadpisu jsou v CMS tři pole: první dvě mají vlastní, třetí sedí
    // mezi `items` pod svým původním jménem. Sázejí se pod sebe, takže slepené
    // do jednoho řetězce by se nedaly rozdělit zpátky — „v Keramické" není
    // jedno slovo.
    const title1 = block?.title || "Vítejte"
    const title2 = block?.headline || "v Keramické"
    const title3 = itemValue(block, "title3") || "Zahradě"
    // Dva odstavce textu; migrace je uložila jako dvě <p> za sebou. Čtou se
    // z `body`, protože hranici odstavce nese jenom HTML — `bodyText` je po
    // `plainText()` jediná řádka, takže tohle vracelo oba odstavce slepené do
    // prvního a druhý sloupec padal na zálohu. Viz `paragraphs()`.
    const paras = paragraphs(block)

    /* Derived from the copy's own length rather than hardcoded, because all three lines come from
       Sanity and an editor changing "Vítejte" to something longer must not desynchronise them. */
    const line1Delay = LINE_LEAD
    const line2Delay = line1Delay + title1.length * CHAR_STEP * LINE_OVERLAP
    const line3Delay = line2Delay + title2.length * CHAR_STEP * LINE_OVERLAP
    const contentDelay = line3Delay + title3.length * CHAR_STEP * LINE_OVERLAP + 0.1

    const railAnim = {
        start: { opacity: 0, y: 8 },
        enter: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, ease: enterEase },
        },
    }
    const railLineAnim = {
        start: { scaleX: 0 },
        enter: {
            scaleX: 1,
            transition: { duration: 1.1, delay: 0.08, ease: enterEase },
        },
    }
    const imageAnim = {
        start: {
            opacity: 0,
            width: "0%",
        },
        enter: {
            opacity: 1,
            /*
             * The plate's width lives in style.scss as `--intro-plate-w` and is read from there,
             * not copied. This wrapper is what pushes the word across, so the two have to be the
             * same number: when they were two literals, making the plate height-aware would have
             * left the wrapper opening wider than the plate it holds, with the gap showing as
             * dead space before the word.
             *
             * Framer resolves the token off the element, measures the pixels it lands on to run
             * the tween, and writes the token itself back as the final value — so the wrapper
             * finishes bound to the stylesheet and keeps re-resolving on resize.
             */
            width: "var(--intro-plate-w)",
            transition: {
                duration: 0.9,
                /* Opens just ahead of the line it sits beside, so the word is pushed across by an
                   image that is already there rather than arriving after it. */
                delay: Math.max(0, line2Delay - 0.08),
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }
    /*
     * Popisky lišty pod sekcí.
     *
     * Každý je vlastní položka `accent`, ne jeden slepený řetězec: jsou to dva samostatné
     * popisky na dvou koncích lišty a redaktor mění jeden bez druhého. Celý text včetně
     * oddělovače („01 · ") je uvnitř položky schválně — v editoru se pak čte přesně to,
     * co stojí na stránce.
     */
    const railLeft = block?.accent?.[0]?.trim() || "01 · Keramická zahrada";
    const railRight = block?.accent?.[1]?.trim() || "Ručně, v píseckém ateliéru";

    /*
     * Poznámka vpravo — vlastní pole, ne druhý odstavec `body`.
     *
     * Jako druhý odstavec ji nešlo označit samostatně (`editable` píše celé pole), takže
     * rámeček v editoru musel obejmout oba sloupce najednou. `paras[1]` zůstává jako záloha
     * pro obsah, který ještě takhle rozdělený není.
     */
    const aside =
        block?.accent?.[2]?.trim() ||
        paras[1] ||
        "Pro zahradu i pro domov. Vzniká to pomalu a jen v malém počtu.";

    return (
        <section className="ECom__Intro" ref={ref}>
            {/* `aria-hidden` zůstává — lišta je typografická ozdoba a čtečce nic nepřidá.
                Anotace pro vizuální editaci jsou na tom nezávislé: překryv čte DOM, ne
                strom pro asistivní technologie. */}
            <div className="ECom__Intro__Rail" aria-hidden="true">
                <motion.span
                    animate={isInView ? "enter" : "start"}
                    variants={railAnim}
                    {...editable(block, "accent.0")}
                >
                    {railLeft}
                </motion.span>
                <motion.span
                    className="rail__line"
                    style={railLineStyle}
                    animate={isInView ? "enter" : "start"}
                    variants={railLineAnim}
                />
                <motion.span
                    animate={isInView ? "enter" : "start"}
                    variants={railAnim}
                    {...editable(block, "accent.1")}
                >
                    {railRight}
                </motion.span>
            </div>
            <div className="ECom__Intro__Title">
                <h2 {...editable(block, "title")}>
                    {charSplit(title1, isInView, line1Delay)}
                </h2>
                <div className="Hero__Intro__Container">
                    <motion.div
                        className="Hero__Intro__Img_Wrapper"
                        style={styleObj}
                        animate={isInView ? "enter" : "start"}
                        variants={imageAnim}
                    >
                        <div
                            className="Hero__Intro__Img__Container">
                            <Image
                                src={block?.image?.url || "/assets/img/img/3.jpg"}
                                {...editable(block, "image", "image")}
                                alt="Intro Image"
                                fill={true}
                                sizes="40dvw"
                                priority={true}
                                className="Hero__Intro__Img"
                            />
                        </div>
                    </motion.div>
                    <h2 {...editable(block, "headline")}>
                        {charSplit(title2, isInView, line2Delay)}
                    </h2>
                </div>
                <h2>
                    {charSplit(title3, isInView, line3Delay)}
                </h2>
            </div>
            {/*
              * Anotace jsou na JEDNOTLIVÝCH odstavcích, ne na jejich obalu.
              *
              * Překryv pro vizuální editaci obkresluje anotovaný prvek. Dokud seděla anotace
              * tady na obalu, byl rámeček přes obě sloupce — od textu vlevo až k poznámce
              * vpravo — a vypadal, jako by text přetékal. Nepřetékal: obal je `static` grid
              * o dvou drahách a rámeček jen věrně kreslil jeho šířku.
              *
              * Rozdělit to šlo teprve tím, že poznámka dostala vlastní pole (`accent.2`).
              * `editable` zapisuje vždy celé pole, takže dva sourozenci nad jedním polem
              * mít dvě anotace nemůžou.
              */}
            <div className="ECom__Intro__Content">
                <p {...editable(block, "body")}>
                    {paras[0] ? textWithBreaks(paras[0], isInView, contentDelay) : wordSplit("Každý výrobek tvořím rukama, jeden po druhém. Žádné dva nejsou úplně stejné — a to je na tom to hezké.", isInView, contentDelay)}
                </p>
                <p className="ECom__Intro__Aside" {...editable(block, "accent.2")}>
                    {textWithBreaks(aside, isInView, contentDelay + 0.12)}
                </p>
            </div>
        </section>
    );
}


const wordSplit = (text: string, isInView: boolean, baseDelay = 0) => {
    const PreloaderAnimText = {
        start: {
            opacity: 0,
            y: 20,
        },
        enter: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.55,
                delay: baseDelay + (i * WORD_STEP),
                ease: enterEase,
            }
        })
    }
    return text.split(' ').map((word, index) => (
        <motion.span
            key={index}
            animate={isInView ? "enter" : "start"}
            variants={PreloaderAnimText}
            custom={index}
            style={styleObj2}
        >
            {word}
        </motion.span>
    ));
}

const textWithBreaks = (text: string, isInView: boolean, baseDelay = 0) => {
    const PreloaderAnimText = {
        start: {
            opacity: 0,
            y: 20,
        },
        enter: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.55,
                delay: baseDelay + (i * WORD_STEP),
                ease: enterEase,
            }
        })
    }

    // Split by line breaks first, then by spaces. The running index carries across lines so a
    // multi-line paragraph staggers as one block instead of restarting on every break.
    const lines = text.split('\n')
    let wordCounter = 0

    return lines.map((line, lineIndex) => (
        <span key={lineIndex} style={styleObj3}>
            {line.split(' ').map((word, wordIndex) => {
                const globalIndex = wordCounter++
                return (
                    <motion.span
                        key={wordIndex}
                        animate={isInView ? "enter" : "start"}
                        variants={PreloaderAnimText}
                        custom={globalIndex}
                        style={styleObj4}
                    >
                        {word + " "}
                    </motion.span>
                );
            })}
            {lineIndex < lines.length - 1 && <br />}
        </span>
    ));
}

const charSplit = (text: string, isInView: boolean, baseDelay = 0) => {
    const charAnim = {
        start: {
            opacity: 0,
            y: 26,
        },
        enter: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.62,
                delay: baseDelay + (i * CHAR_STEP),
                ease: enterEase,
            }
        })
    }

    return text.split('').map((char, index) => (
        <motion.span
            key={index}
            animate={isInView ? "enter" : "start"}
            variants={charAnim}
            custom={index}
            className="precise__char"
        >
            {char === " " ? " " : char}
        </motion.span>
    ));
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { transformOrigin: "left center" as const, overflow: "hidden" as const }
const styleObj2 = { display: "inline-block" as const, whiteSpace: "pre" as const, marginRight: "0.25em" as const }
const styleObj3 = { display: "inline" as const }
const styleObj4 = { display: "inline-block" as const, whiteSpace: "pre" as const,}
const railLineStyle = { transformOrigin: "left center" as const }
