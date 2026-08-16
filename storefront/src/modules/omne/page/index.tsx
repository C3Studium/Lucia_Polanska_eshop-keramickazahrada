"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"

// import AboutInfo from "@modules/omne/about"
import AboutCta from "@modules/omne/cta"
import AboutMe from "@modules/omne/main"
import AboutStory from "@modules/omne/story"
// import ProcessAbout from "@modules/omne/process"

const phaseEase = (value: number) => 1 - Math.pow(1 - value, 3)

export default function AboutPageExperience() {
    const backgroundTriggerRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: backgroundTriggerRef,
        offset: ["0 0.9", "0 0.65"],
    })

    const backgroundColor = useTransform(
        scrollYProgress,
        [0, .3, .68, 1],
        ["#BBB788", "#c9c397", "#ead5bf", "#FFE8D6"],
        { ease: phaseEase }
    )
    const glazeOpacity = useTransform(
        scrollYProgress,
        [0, .08, .42, .82, 1],
        [0, .12, .72, .46, 0]
    )
    const glazeScale = useTransform(
        scrollYProgress,
        [0, 1],
        [.68, 1.7],
        { ease: phaseEase }
    )
    const glazeX = useTransform(scrollYProgress, [0, 1], ["-14%", "16%"])
    const glazeY = useTransform(scrollYProgress, [0, 1], ["-18%", "20%"])
    const grainOpacity = useTransform(
        scrollYProgress,
        [0, .24, .72, 1],
        [0, .035, .065, .025]
    )

    return (
        <motion.main
            className="aboutPage"
            style={{ backgroundColor }}
        >
            <motion.div
                className="aboutPage__glaze"
                style={{
                    opacity: glazeOpacity,
                    scale: glazeScale,
                    x: glazeX,
                    y: glazeY,
                }}
                aria-hidden="true"
            />
            <motion.div
                className="aboutPage__grain"
                style={{ opacity: grainOpacity }}
                aria-hidden="true"
            />

            <AboutMe />
            <div
                ref={backgroundTriggerRef}
                className="aboutPage__phaseTrigger"
                aria-hidden="true"
            />
            {/* Vyroba-gallery variant carrying the old AboutInfo copy (no icons). */}
            <AboutStory />
            {/* <AboutInfo />
            <ProcessAbout /> */}
            <AboutCta />
        </motion.main>
    )
}
