"use client"

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import Carousel from "./Carousel";
import Intro from "./intro";

export default function IntroSection({ data }: { data?: any }) {
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
            data-scroll-label="Objekty"
        >
            <motion.div
                className="home__introChapter__Opening"
                style={{ y: introY, opacity: introOpacity }}
            >
                <Intro data={data} />
            </motion.div>
            <motion.div
                className="home__introChapter__Gallery"
                style={{ y: carouselY }}
            >
                <Carousel />
            </motion.div>
        </div>
    )
}
