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

const ease = [.22, 1, .36, 1] as const
const titleWords = ["Proces", "končí."]

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

export default function VyrobaCta() {
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
                <span>08 · Výsledek</span>
                <motion.i variants={ruleReveal} />
                <span>Ručně vytvořeno v Písku</span>
            </header>

            <div className="vyrobaCta__composition">
                <div className="vyrobaCta__visuals" aria-hidden="true">
                    <motion.figure
                        className="vyrobaCta__image vyrobaCta__image--main"
                        variants={imageReveal}
                        style={{ x: mainX, y: mainY }}
                    >
                        <motion.div className="vyrobaCta__imageScale" variants={imageScale}>
                            <Image
                                src="/assets/img/img/10.jpg"
                                alt=""
                                fill
                                sizes="(max-width: 720px) 80vw, 40vw"
                            />
                        </motion.div>
                        <figcaption>
                            <span>Hotový objekt</span>
                            <i />
                            <span>Keramická zahrada</span>
                        </figcaption>
                    </motion.figure>

                    <motion.figure
                        className="vyrobaCta__image vyrobaCta__image--detail"
                        variants={detailReveal}
                        style={{ x: detailX, y: detailY }}
                    >
                        <motion.div className="vyrobaCta__imageScale" variants={imageScale}>
                            <Image
                                src="/assets/img/vyroba/6.png"
                                alt=""
                                fill
                                sizes="(max-width: 720px) 35vw, 16vw"
                            />
                        </motion.div>
                        <figcaption>Připraveno na cestu</figcaption>
                    </motion.figure>
                </div>

                <div className="vyrobaCta__content">
                    <motion.p className="vyrobaCta__eyebrow" variants={fadeUp}>
                        Z rukou do vašeho prostoru
                    </motion.p>

                    <h2 id="vyroba-cta-title" aria-label="Proces končí. Příběh začíná u vás.">
                        <span className="vyrobaCta__line" aria-hidden="true">
                            {titleWords.map((word) => {
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
                            <motion.span variants={accentReveal} aria-hidden="true">
                                Příběh začíná u vás.
                            </motion.span>
                        </span>
                    </h2>

                    <motion.div className="vyrobaCta__action" variants={fadeUp}>
                        <p>
                            Objevte autorské objekty, které prošly celým procesem
                            pomalu, ručně a v malém počtu.
                        </p>
                        <WebButton
                            Kind="Link"
                            href="/store"
                            title="Prohlédnout objekty"
                            className="vyrobaCta__button"
                        />
                    </motion.div>
                </div>
            </div>
        </motion.section>
    )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const viewport = { once: true, amount: .24 }
