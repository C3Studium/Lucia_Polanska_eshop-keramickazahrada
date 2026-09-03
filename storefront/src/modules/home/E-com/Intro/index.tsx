"use client"

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import Carousel from "./Carousel";
import Intro from "./intro";
import { button } from "@lib/util/site-copy";
import type { CopyBlock, CopyBlocks } from "@lib/util/site-copy";

export default function IntroSection({
    block,
    copy,
}: {
    block?: CopyBlock
    /** Celá mapa — karusel v galerii drží vlastní tlačítko. */
    copy?: CopyBlocks
}) {
    const chapterRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: chapterRef,
        offset: ["start end", "end start"],
    });
    const progress = useSpring(scrollYProgress, {
        stiffness: 72,
        damping: 30,
        mass: 0.52,
        restDelta: 0.0005,
    });
    const introY = useTransform(progress, [0, 0.45, 0.8], [18, 0, -16]);
    const introOpacity = useTransform(progress, [0, 0.68, 0.86], [1, 1, 0.82]);
    const carouselY = useTransform(progress, [0.16, 0.52, 0.86], [28, 0, -12]);

    return (
        <div
            className="home__introChapter"
            ref={chapterRef}
            id="home-objects"
            data-scroll-section
            data-scroll-label="Výrobky"
        >
            <motion.div
                className="home__introChapter__Opening"
                style={{ y: introY, opacity: introOpacity }}
            >
                <Intro block={block} />
            </motion.div>
            <motion.div
                className="home__introChapter__Gallery"
                style={{ y: carouselY }}
            >
                {/* Karusel má vlastní blok — je to samostatná sekce s vlastní lištou
                    („02 · Výběr z ateliéru"), ne pokračování té nad ním. */}
                <Carousel
                    block={copy?.["index.ecom-carousel"]}
                    cta={button(copy, "index.zakazka")}
                />
            </motion.div>
        </div>
    )
}
