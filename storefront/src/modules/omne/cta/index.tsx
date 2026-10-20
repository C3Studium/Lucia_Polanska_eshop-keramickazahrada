"use client"

import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import { button, itemValue } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import type { CopyBlocks } from "@lib/util/site-copy"
import Image from "next/image"
import {
    motion,
    useMotionValue,
    useSpring,
    useTransform,
    type Variants,
} from "framer-motion"

import WebButton from "@modules/common/components/Buttons/webButton"

/*
 * Nadpis se animuje po znacích a ve dvou „slovech" — první slovo, pak zbytek
 * řádku. Z CMS přijde jako jeden řetězec (`o-mne.cta` → `title`), takže se
 * dělí na první mezeře; výchozí „Teď je řada" tak dá přesně původní dvojici.
 */
const splitTitle = (title: string) => {
    const space = title.indexOf(" ")
    return space < 0 ? [title] : [title.slice(0, space), title.slice(space + 1)]
}
const motionEase = [.22, 1, .36, 1] as const

const ruleAnim: Variants = {
    hidden: { scaleX: 0 },
    visible: {
        scaleX: 1,
        transition: { duration: .8, ease: motionEase },
    },
}

const mainImageAnim: Variants = {
    hidden: { clipPath: "inset(0% 100% 0% 0%)" },
    visible: {
        clipPath: "inset(0% 0% 0% 0%)",
        transition: { delay: .06, duration: .9, ease: motionEase },
    },
}

const detailImageAnim: Variants = {
    hidden: { clipPath: "inset(100% 0% 0% 0%)" },
    visible: {
        clipPath: "inset(0% 0% 0% 0%)",
        transition: { delay: .24, duration: .82, ease: motionEase },
    },
}

const imageScaleAnim: Variants = {
    hidden: { scale: 1.14 },
    visible: {
        scale: 1,
        transition: { delay: .06, duration: 1.05, ease: motionEase },
    },
}

const characterAnim: Variants = {
    hidden: {
        opacity: .08,
        y: ".72em",
        clipPath: "inset(0% 0% 100% 0%)",
    },
    visible: (index: number) => ({
        opacity: 1,
        y: "0em",
        clipPath: "inset(0% 0% 0% 0%)",
        transition: {
            delay: .22 + index * .026,
            duration: .56,
            ease: motionEase,
        },
    }),
}

const accentAnim: Variants = {
    hidden: {
        x: -90,
        opacity: 0,
        clipPath: "inset(0% 100% 0% 0%)",
    },
    visible: {
        x: 0,
        opacity: 1,
        clipPath: "inset(0% 0% 0% 0%)",
        transition: {
            delay: .5,
            duration: .72,
            ease: motionEase,
        },
    },
}

const supportingAnim: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            delay: .72,
            duration: .62,
            ease: motionEase,
        },
    },
}

const eyebrowAnim: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            delay: .18,
            duration: .5,
            ease: motionEase,
        },
    },
}

function TitleCharacter({ character, index }: { character: string; index: number }) {
    return (
        <motion.span
            className="aboutCta__character"
            variants={characterAnim}
            custom={index}
        >
            {character}
        </motion.span>
    )
}

export default function AboutCta({ copy }: { copy?: CopyBlocks }) {
    /* Sekce se hýbe jen z motion hodnot — bez tohohle by po zapnutí editace
       zůstaly anotace prázdné. Viz hook. */
    useEditRerender()

    // Vede dovnitř webu — z CMS se bere jen název, cíl `/store` drží kód.
    const cta = button(copy, "o-mne.vyrobky")

    /*
     * Texty závěru z bloku `o-mne.cta`. Lišta nahoře a obočí nad nadpisem jsou
     * položky klíčované popiskem (`lista.vlevo`, `lista.vpravo`, `oboci`) —
     * ne pozice v `accent`, ze kterého CMS prázdné položky vyhazuje a zbytek
     * by se posunul. Nadpis je `title` + zvýrazněný konec v `headline` — dva
     * prvky, dvě pole. Popisky u fotek zůstávají v kódu: vizuál je celý
     * `aria-hidden`, je to ozdoba kompozice, ne text.
     */
    const block = copy?.["o-mne.cta"]
    const metaLeft = itemValue(block, "lista.vlevo")?.trim() || "04 · Pokračování"
    const metaRight = itemValue(block, "lista.vpravo")?.trim() || "Ručně, v píseckém ateliéru"
    const eyebrow = itemValue(block, "oboci")?.trim() || "Z ateliéru k vám domů"
    const title = block?.title?.trim() || "Teď je řada"
    const titleAccent = block?.headline?.trim() || "na vás."
    const lede =
        block?.bodyText?.trim() ||
        "Podívejte se na keramiku pro zahradu i domov. Všechno vzniká pomalu a jen v malém počtu."
    const titleWords = splitTitle(title)

    const pointerX = useMotionValue(0)
    const pointerY = useMotionValue(0)
    const imageX = useSpring(pointerX, { stiffness: 110, damping: 24, mass: .6 })
    const imageY = useSpring(pointerY, { stiffness: 110, damping: 24, mass: .6 })
    const detailX = useTransform(imageX, (value) => value * -.65)
    const detailY = useTransform(imageY, (value) => value * -.65)

    const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const x = (event.clientX - bounds.left) / bounds.width - .5
        const y = (event.clientY - bounds.top) / bounds.height - .5

        pointerX.set(x * 12)
        pointerY.set(y * 8)
    }

    const resetPointer = () => {
        pointerX.set(0)
        pointerY.set(0)
    }

    return (
        <motion.section
            className="aboutCta"
            id="about-objects"
            data-scroll-section
            data-scroll-label="Výrobky"
            aria-labelledby="about-cta-title"
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
            initial="hidden"
            whileInView="visible"
            viewport={viewport}
        >
            <header className="aboutCta__meta">
                <span {...editableItem(block, "lista.vlevo")}>{metaLeft}</span>
                <motion.i variants={ruleAnim} />
                <span {...editableItem(block, "lista.vpravo")}>{metaRight}</span>
            </header>

            <div className="aboutCta__composition">
                <div className="aboutCta__visuals" aria-hidden="true">
                    <motion.figure
                        className="aboutCta__image aboutCta__image--main"
                        variants={mainImageAnim}
                        style={{ x: imageX, y: imageY }}
                    >
                        <motion.div className="aboutCta__imageScale" variants={imageScaleAnim}>
                            <Image
                                src="/assets/img/img/10.jpg"
                                alt=""
                                fill
                                sizes="(max-width: 720px) 72vw, 38vw"
                            />
                        </motion.div>
                        <figcaption>
                            <span>Autorská keramika</span>
                            <i />
                            <span>Písek</span>
                        </figcaption>
                    </motion.figure>

                    <motion.figure
                        className="aboutCta__image aboutCta__image--detail"
                        variants={detailImageAnim}
                        style={{ x: detailX, y: detailY }}
                    >
                        <motion.div className="aboutCta__imageScale" variants={imageScaleAnim}>
                            <Image
                                src="/assets/img/img/1.jpg"
                                alt=""
                                fill
                                sizes="(max-width: 720px) 34vw, 16vw"
                            />
                        </motion.div>
                        <figcaption>Každý kus originál</figcaption>
                    </motion.figure>
                </div>

                <div className="aboutCta__content">
                    <motion.p
                        className="aboutCta__eyebrow"
                        variants={eyebrowAnim}
                        {...editableItem(block, "oboci")}
                    >
                        {eyebrow}
                    </motion.p>

                    {/* `title` bez anotace v místě: znaky jsou rozsypané do spanů
                        bez mezer mezi slovy, editor by z nich přečetl „Teďje řada".
                        Upravuje se ve formuláři bloku. */}
                    <h2 id="about-cta-title" aria-label={`${title} ${titleAccent}`}>
                        <span className="aboutCta__line" aria-hidden="true">
                            {titleWords.map((word, wordIndex) => {
                                const characterOffset = titleWords
                                    .slice(0, wordIndex)
                                    .reduce((length, item) => length + item.length, 0)

                                return (
                                    <span className="aboutCta__word" key={word}>
                                        {Array.from(word).map((character, characterIndex) => (
                                            <TitleCharacter
                                                character={character}
                                                index={characterOffset + characterIndex}
                                                key={`${word}-${characterIndex}`}
                                            />
                                        ))}
                                    </span>
                                )
                            })}
                        </span>
                        <span className="aboutCta__line aboutCta__line--accent">
                            <motion.span
                                variants={accentAnim}
                                aria-hidden="true"
                                {...editable(block, "headline")}
                            >
                                {titleAccent}
                            </motion.span>
                        </span>
                    </h2>

                    <motion.div
                        className="aboutCta__action"
                        variants={supportingAnim}
                    >
                        <p {...editable(block, "body")}>{lede}</p>
                        <span {...editable(cta, "label")}>
                            <WebButton
                                Kind="Link"
                                href="/store"
                                title={cta?.label?.trim() || "Prohlédnout výrobky"}
                                className="aboutCta__button"
                            />
                        </span>
                    </motion.div>
                </div>
            </div>
        </motion.section>
    )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const viewport = { once: true, amount: .22 }
