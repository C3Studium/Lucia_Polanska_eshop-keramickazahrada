"use client"

import { motion, useMotionValue } from "framer-motion"
import Image from "next/image";
import type { PointerEvent } from "react";
import AboutHeroShader from "./AboutHeroShader";

export default function AboutMe () {
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

    return (
        <section
            className="AboutMe"
            id="about-intro"
            data-scroll-section
            data-scroll-label="Představení"
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
        >
            <motion.div
                className="aboutHeroShaderStage"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: .7, delay: .55, ease: [.22, 1, .36, 1] }}
            >
                <AboutHeroShader
                    pointerX={pointerX}
                    pointerY={pointerY}
                />
            </motion.div>
            <p className="about__eyebrow">
                O mně · keramická zahrada
            </p>
            <div className="Text__content">
                <div className="image__intro">
                    <motion.div
                        className="image__wrapper"
                        initial={{ clipPath: "inset(0 100% 0 0 round 20px)" }}
                        animate={{ clipPath: "inset(0 0% 0 0 round 20px)" }}
                        transition={{ duration: 1.15, ease: [.76, 0, .24, 1] }}
                    />
                    <div className="about__imageMeta" aria-hidden="true">
                        <span>Ručně tvořeno</span>
                        <i />
                        <span>Písek · od roku 2014</span>
                    </div>
                    <h1>
                        <span>
                            Jmenuji se
                        </span>
                        <span className="handwritten">
                            Lucie Polanská
                        </span>
                    </h1>
                </div>
                <div className="greetings">
                    <span className="greetings__icon" aria-hidden="true">
                        <motion.span
                            animate={{ rotate: [0, 7, -3, 6, 0] }}
                            transition={{ duration: 1.65, repeat: Infinity, repeatDelay: 4.2, ease: "easeInOut" }}
                        >
                            <Image src="/assets/icons/wawing_hand.png" alt="" width={78} height={78}/>
                        </motion.span>
                    </span>
                    <p>
                        Těší mě
                    </p>
                    <span className="greetings__line" aria-hidden="true" />
                </div>
            </div>
            <motion.div
                className="Images__content"
                initial={{ clipPath: "inset(100% 0 0 0 round 20px)" }}
                animate={{ clipPath: "inset(0% 0 0 0 round 20px)" }}
                transition={{ duration: 1, delay: .45, ease: [.76, 0, .24, 1] }}
            />
            <span className="portrait__caption">
                Ateliér · Písek
            </span>
            <div className="about__chapterTransition" aria-label="Začátek kapitoly Můj příběh">
                <span>01</span>
                <i aria-hidden="true" />
                <span>Můj příběh</span>
            </div>
        </section>
    )
}
