"use client"

import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import FAQBody from "@modules/dotazy/FAQ"
import { motion, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion"
import { useRef, type PointerEvent } from "react"
import FAQImageShader from "./FAQImageShader"

export default function DotazyMain () {
    const heroRef = useRef<HTMLDivElement>(null)
    // Shader/cursor reduced-motion fallback is intentionally disabled for now.
    // const reduceMotion = useReducedMotion()
    const pointerX = useMotionValue(0)
    const pointerY = useMotionValue(0)
    const cursorX = useSpring(pointerX, { stiffness: 105, damping: 15, mass: 0.42 })
    const cursorY = useSpring(pointerY, { stiffness: 105, damping: 15, mass: 0.42 })
    const glowX = useTransform(cursorX, [-0.5, 0.5], ["54%", "74%"])
    const glowY = useTransform(cursorY, [-0.5, 0.5], ["34%", "68%"])
    const heroLight = useMotionTemplate`radial-gradient(circle at ${glowX} ${glowY}, rgba(255, 232, 214, 0.34) 0%, rgba(255, 232, 214, 0.14) 24%, rgba(255, 232, 214, 0) 58%)`
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
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12, duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
                    >
                        <span>Pomoc &amp; informace</span>
                        <span>Ateliér Lucie Polanské · 01</span>
                    </motion.div>
                </motion.div>
                <motion.div
                    className="faqShaderStage"
                    initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
                    animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
                    transition={{ delay: 0.14, duration: 1.05, ease: [0.76, 0, 0.24, 1] }}
                    style={{ opacity: heroChromeOpacity, y: heroChromeY }}
                >
                    <FAQImageShader pointerX={pointerX} pointerY={pointerY} />
                </motion.div>
                <motion.div
                    className="faqHeroCaption"
                    style={{ opacity: heroChromeOpacity, y: heroChromeY }}
                >
                    <motion.div
                        className="faqHeroCaptionInner"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.48, duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
                    >
                        <span className="faqHeroKicker">Nejčastější otázky · 01</span>
                        <h2>
                            Než si keramika
                            <em> najde místo u vás.</em>
                        </h2>
                        <p>Vše podstatné o objednávkách, péči o keramiku a zakázkové práci našeho ateliéru.</p>
                        <a href="#faq-section-title" onClick={scrollToAnswers}>
                            Procházet odpovědi
                            <span aria-hidden="true">↓</span>
                        </a>
                    </motion.div>
                </motion.div>
                <motion.div
                    className="faqHeroScrollCue"
                    style={{ opacity: heroChromeOpacity }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.85, duration: 0.7 }}
                    aria-hidden="true"
                >
                    <span>Pokračovat</span>
                    <i />
                </motion.div>
            </motion.div>

            <motion.h1
                className="travellingFAQ"
                initial={{ clipPath: "inset(0 100% 0 0)" }}
                animate={{ clipPath: "inset(0 0% 0 0)" }}
                transition={{ delay: 0.28, duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
                style={{ x: faqComposedX, y: faqComposedY, scale: faqScale, rotate: faqRotate, opacity: faqOpacity, letterSpacing: faqTracking }}
            >
                FAQ
            </motion.h1>

            <FAQBody />
        </section>
    )
}
