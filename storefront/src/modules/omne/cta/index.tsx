"use client"

import Image from "next/image"
import {
    motion,
    useMotionValue,
    useSpring,
    useTransform,
    type Variants,
} from "framer-motion"

import WebButton from "@modules/common/components/Buttons/webButton"

const titleWords = ["Teď", "je řada"]
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

export default function AboutCta() {
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
                <span>04 · Pokračování</span>
                <motion.i variants={ruleAnim} />
                <span>Ručně, v píseckém ateliéru</span>
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
                    >
                        Z ateliéru k vám domů
                    </motion.p>

                    <h2 id="about-cta-title" aria-label="Teď je řada na vás.">
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
                            >
                                na vás.
                            </motion.span>
                        </span>
                    </h2>

                    <motion.div
                        className="aboutCta__action"
                        variants={supportingAnim}
                    >
                        <p>
                            Podívejte se na keramiku pro zahradu i domov. Všechno
                            vzniká pomalu a jen v malém počtu.
                        </p>
                        <WebButton
                            Kind="Link"
                            href="/store"
                            title="Prohlédnout výrobky"
                            className="aboutCta__button"
                        />
                    </motion.div>
                </div>
            </div>
        </motion.section>
    )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const viewport = { once: true, amount: .22 }
