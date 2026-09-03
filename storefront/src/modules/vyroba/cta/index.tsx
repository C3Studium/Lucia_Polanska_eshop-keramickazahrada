"use client"

import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import { button } from "@lib/util/site-copy"
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

const ease = [.22, 1, .36, 1] as const
/*
 * Jedno slovo = jedna položka. Mezera uvnitř položky se ztratí: každý znak dostane svůj
 * `display: inline-block` span (kvůli postupnému odkrývání) a span, ve kterém je jenom mezera,
 * se zúží na nulu. Nadpis se proto sázel jako „Takhle tovzniká." — mezeru mezi slovy dělá
 * `margin-left: .22em` na `.vyrobaCta__word`, ne znak.
 *
 * Samotné znění nadpisu je v komponentě (`titleText`) — z CMS, se zálohou v kódu.
 */

const ruleReveal: Variants = {
    hidden: { scaleX: 0 },
    visible: {
        scaleX: 1,
        transition: { duration: .85, ease },
    },
}

const imageReveal: Variants = {
    hidden: { clipPath: "inset(0% 100% 0% 0%)" },
    visible: {
        clipPath: "inset(0% 0% 0% 0%)",
        transition: { delay: .08, duration: 1, ease },
    },
}

const detailReveal: Variants = {
    hidden: { clipPath: "inset(100% 0% 0% 0%)" },
    visible: {
        clipPath: "inset(0% 0% 0% 0%)",
        transition: { delay: .28, duration: .84, ease },
    },
}

const imageScale: Variants = {
    hidden: { scale: 1.12 },
    visible: {
        scale: 1,
        transition: { delay: .08, duration: 1.15, ease },
    },
}

const characterReveal: Variants = {
    hidden: { opacity: .06, y: ".65em" },
    visible: (index: number) => ({
        opacity: 1,
        y: "0em",
        transition: {
            delay: .2 + index * .025,
            duration: .55,
            ease,
        },
    }),
}

const accentReveal: Variants = {
    hidden: { opacity: 0, x: -62, clipPath: "inset(0% 100% 0% 0%)" },
    visible: {
        opacity: 1,
        x: 0,
        clipPath: "inset(0% 0% 0% 0%)",
        transition: { delay: .52, duration: .72, ease },
    },
}

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 14 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { delay: .68, duration: .62, ease },
    },
}

export default function VyrobaCta({ copy }: { copy?: CopyBlocks }) {
    /* Sekce se odhaluje jen přes whileInView — bez tohohle by po zapnutí režimu
       editace zůstaly anotace prázdné. Viz hook. */
    useEditRerender()

    // Vede dovnitř webu — z CMS se bere jen název, cíl `/store` drží kód.
    const cta = button(copy, "vyroba.vyrobky")

    const block = copy?.["vyroba.cta"]
    const railLeft = block?.accent?.[0]?.trim() || "08 · Výsledek"
    const railRight = block?.accent?.[1]?.trim() || "Ručně vytvořeno v Písku"
    const eyebrow = block?.accent?.[2]?.trim() || "Z mých rukou k vám domů"
    const captionLeft = block?.accent?.[3]?.trim() || "Hotový kus"
    const captionRight = block?.accent?.[4]?.trim() || "Keramická zahrada"
    const detailCaption = block?.accent?.[5]?.trim() || "Připraveno na cestu"
    /* Nadpis se sází po znacích, tak se slova z CMS jen rozdělí — animace si
       je rozporcuje stejně jako dřív ta zapsaná. */
    const titleText = block?.title?.trim() || "Takhle to vzniká."
    const cmsTitleWords = titleText.split(/\s+/)
    const titleAccentText = block?.headline?.trim() || "Zbytek je na vás."
    const actionText =
        block?.bodyText?.trim() ||
        "Podívejte se na keramiku, která tímhle vším prošla — ručně, pomalu a jen v malém počtu."
    const mainPhoto = block?.gallery?.[0]
    const detailPhoto = block?.gallery?.[1]

    const pointerX = useMotionValue(0)
    const pointerY = useMotionValue(0)
    const mainX = useSpring(pointerX, { stiffness: 105, damping: 25, mass: .65 })
    const mainY = useSpring(pointerY, { stiffness: 105, damping: 25, mass: .65 })
    const detailX = useTransform(mainX, (value) => value * -.72)
    const detailY = useTransform(mainY, (value) => value * -.72)

    const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const x = (event.clientX - bounds.left) / bounds.width - .5
        const y = (event.clientY - bounds.top) / bounds.height - .5

        pointerX.set(x * 9)
        pointerY.set(y * 6)
    }

    const resetPointer = () => {
        pointerX.set(0)
        pointerY.set(0)
    }

    let characterIndex = 0

    return (
        <motion.section
            className="vyrobaCta"
            id="process-result"
            data-scroll-section
            data-scroll-label="Výsledek"
            aria-labelledby="vyroba-cta-title"
            initial="hidden"
            whileInView="visible"
            viewport={viewport}
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
        >
            <header className="vyrobaCta__meta">
                <span {...editable(block, "accent.0")}>{railLeft}</span>
                <motion.i variants={ruleReveal} />
                <span {...editable(block, "accent.1")}>{railRight}</span>
            </header>

            <div className="vyrobaCta__composition">
                <div className="vyrobaCta__visuals" aria-hidden="true">
                    <motion.figure
                        className="vyrobaCta__image vyrobaCta__image--main"
                        variants={imageReveal}
                        style={{ x: mainX, y: mainY }}
                    >
                        <motion.div
                            className="vyrobaCta__imageScale"
                            variants={imageScale}
                            {...editable(block, "gallery.0", "image")}
                        >
                            <Image
                                src={mainPhoto?.url ?? "/assets/img/img/10.jpg"}
                                alt={mainPhoto?.alt ?? ""}
                                fill
                                sizes="(max-width: 720px) 80vw, 40vw"
                            />
                        </motion.div>
                        <figcaption>
                            <span {...editable(block, "accent.3")}>{captionLeft}</span>
                            <i />
                            <span {...editable(block, "accent.4")}>{captionRight}</span>
                        </figcaption>
                    </motion.figure>

                    <motion.figure
                        className="vyrobaCta__image vyrobaCta__image--detail"
                        variants={detailReveal}
                        style={{ x: detailX, y: detailY }}
                    >
                        <motion.div
                            className="vyrobaCta__imageScale"
                            variants={imageScale}
                            {...editable(block, "gallery.1", "image")}
                        >
                            <Image
                                src={detailPhoto?.url ?? "/assets/img/vyroba/6.png"}
                                alt={detailPhoto?.alt ?? ""}
                                fill
                                sizes="(max-width: 720px) 35vw, 16vw"
                            />
                        </motion.div>
                        <figcaption {...editable(block, "accent.5")}>{detailCaption}</figcaption>
                    </motion.figure>
                </div>

                <div className="vyrobaCta__content">
                    <motion.p
                        className="vyrobaCta__eyebrow"
                        variants={fadeUp}
                        {...editable(block, "accent.2")}
                    >
                        {eyebrow}
                    </motion.p>

                    <h2
                        id="vyroba-cta-title"
                        aria-label={`${titleText} ${titleAccentText}`}
                    >
                        <span
                            className="vyrobaCta__line"
                            aria-hidden="true"
                            {...editable(block, "title")}
                        >
                            {cmsTitleWords.map((word) => {
                                const startIndex = characterIndex
                                characterIndex += word.length

                                return (
                                    <span className="vyrobaCta__word" key={word}>
                                        {Array.from(word).map((character, index) => (
                                            <motion.span
                                                className="vyrobaCta__character"
                                                variants={characterReveal}
                                                custom={startIndex + index}
                                                key={`${word}-${index}`}
                                            >
                                                {character}
                                            </motion.span>
                                        ))}
                                    </span>
                                )
                            })}
                        </span>
                        <span className="vyrobaCta__line vyrobaCta__line--accent">
                            <motion.span
                                variants={accentReveal}
                                aria-hidden="true"
                                {...editable(block, "headline")}
                            >
                                {titleAccentText}
                            </motion.span>
                        </span>
                    </h2>

                    <motion.div className="vyrobaCta__action" variants={fadeUp}>
                        <p {...editable(block, "body")}>{actionText}</p>
                        <span {...editable(cta, "label")}>
                            <WebButton
                                Kind="Link"
                                href="/store"
                                title={cta?.label?.trim() || "Prohlédnout výrobky"}
                                className="vyrobaCta__button"
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
const viewport = { once: true, amount: .24 }
