"use client"

import { useRef, useState } from "react"
import {
    motion,
    useMotionValue,
    useMotionValueEvent,
    useScroll,
    useSpring,
    useTransform,
    type MotionValue,
} from "framer-motion"
import Image from "next/image"

const process = [
    {
        src: "/assets/img/ome/4.png",
        alt: "Keramický objekt z ateliéru Lucie Polanské",
        label: "Praxe / Studium",
        lead: "Řemeslo stojí na znalosti materiálu.",
        detail: "V Bechyni jsem získala základ. Vlastní rukopis ale roste každým dalším výpalem.",
    },
    {
        src: "/assets/img/ome/2.png",
        alt: "Lucie Polanská při práci v ateliéru",
        label: "Rodina",
        lead: "Ateliér a rodina se u mě neoddělují.",
        detail: "Obojí mě učí trpělivosti, pozornosti a radosti z věcí, které vznikají pomalu.",
    },
    {
        src: "/assets/img/vyroba/4.png",
        alt: "Keramický objekt zasazený v zahradě",
        label: "Inspirace",
        lead: "Tvary hledám v zahradě, krajině a každodenních rituálech.",
        detail: "Vznikají tak objekty, které mají vlastní charakter a přirozeně stárnou.",
    },
]

const revealEase = (value: number) => 1 - Math.pow(1 - value, 4)
const easeOut = (value: number) => 1 - Math.pow(1 - value, 3)

const getChapterTimeline = (index: number) => {
    const chapterSize = 1 / process.length
    const chapterStart = index * chapterSize
    const chapterEnd = chapterStart + chapterSize
    const chapterDuration = chapterEnd - chapterStart
    const imageStart = chapterStart + chapterDuration * .1
    const imageEnd = chapterEnd - chapterDuration * .25
    const imageDuration = imageEnd - imageStart
    const imageMiddle = imageStart + imageDuration * .5

    return {
        chapterStart,
        chapterEnd,
        imageStart,
        imageEnd,
        imageMiddle,
        textStart: imageStart,
        fadeInEnd: imageStart + imageDuration * .15,
        fadeOutStart: imageStart + imageDuration * .65,
        textEnd: imageStart + imageDuration * .85,
    }
}

function ProcessImage({
    item,
    index,
    imageProgress,
}: {
    item: (typeof process)[number]
    index: number
    imageProgress: MotionValue<number>
}) {
    const pointerX = useMotionValue(0)
    const pointerY = useMotionValue(0)
    const smoothX = useSpring(pointerX, { stiffness: 140, damping: 22, mass: .45 })
    const smoothY = useSpring(pointerY, { stiffness: 140, damping: 22, mass: .45 })

    const { imageStart, imageEnd } = getChapterTimeline(index)

    const imageScale = useTransform(
        imageProgress,
        [imageStart, imageEnd],
        [1.1, 1],
        { ease: easeOut }
    )
    const imageClip = useTransform(
        imageProgress,
        [imageStart, imageEnd],
        ["inset(0% 0% 100% 0%)", "inset(0% 0% 0% 0%)"],
        { ease: revealEase }
    )
    const imageSettleY = useTransform(
        imageProgress,
        [imageStart, imageEnd],
        [12, 0],
        { ease: revealEase }
    )
    const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const x = (event.clientX - bounds.left) / bounds.width - .5
        const y = (event.clientY - bounds.top) / bounds.height - .5

        pointerX.set(x * 14)
        pointerY.set(y * 14)
    }

    const resetPointer = () => {
        pointerX.set(0)
        pointerY.set(0)
    }

    return (
        <motion.figure
            className="Image__container"
            style={{ zIndex: index + 1, clipPath: imageClip }}
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
        >
            <div
                className="image__wrapper"
            >
                <motion.div
                    className="image__movement"
                    style={{ x: smoothX, y: smoothY }}
                >
                    <motion.div
                        className="image__scale"
                        style={{ scale: imageScale, y: imageSettleY }}
                    >
                        <Image
                            src={item.src}
                            alt={item.alt}
                            fill
                            sizes="(max-width: 760px) 100vw, 35vw"
                        />
                    </motion.div>
                </motion.div>
                <span className="image__note">
                    <small>0{index + 1} · {item.label}</small>
                    {item.lead}
                </span>
            </div>
        </motion.figure>
    )
}

function ProcessCopy({
    item,
    index,
    progress,
}: {
    item: (typeof process)[number]
    index: number
    progress: MotionValue<number>
}) {
    let lastOpacity = index === process.length - 1 ? 1 : 0
    const finalTop = index === process.length - 1 ? "0%" : "-40%"
    const {
        imageStart,
        imageMiddle,
        imageEnd,
    } = getChapterTimeline(index)
    const imageDuration = imageEnd - imageStart
    const textTimeline = [
        imageStart,
        imageStart + imageDuration * .15,
        (imageStart + imageEnd) / 2,
        imageEnd - imageDuration * .35,
        imageEnd + imageDuration * .75,
    ]
    const opacityValues = [0, 0, 1, 1, lastOpacity]

    const opacity = useTransform(
        progress,
        textTimeline,
        opacityValues
    )

    const top = useTransform(
        progress,
        textTimeline,
        ["40%", "10%", "0%", "0%", finalTop]
    )

    const lineScale = useTransform(
        progress,
        textTimeline,
        opacityValues
    )

    return (
        <motion.div
            className="text__wrapper"
            style={{
                opacity: opacity,
                top: top,
            }}
        >
            <div className="text__chapterRow">
                <span className="text__chapter">
                    0{index + 1} · {item.label}
                </span>
                <span className="text__chapterLine">
                    <motion.i style={{ scaleX: lineScale }}/>
                </span>
            </div>
            <p className="text__lead">
                {item.lead}
            </p>
            <p className="text__detail">
                {item.detail}
            </p>
        </motion.div>
    )
}

export default function ProcessAbout () {
    const sectionRef = useRef<HTMLElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start 0.5", "end end"],
    })
    const { scrollYProgress: topBarScrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start 0.55", "end end"],
    })
    const { imageStart: firstImageStart } = getChapterTimeline(0)
    const topBarRevealEnd = firstImageStart + .1
    const topBarOpacity = useTransform(
        topBarScrollYProgress,
        [0, topBarRevealEnd],
        [0, 1]
    )
    const topBarTop = useTransform(
        topBarScrollYProgress,
        [0, topBarRevealEnd],
        ["5%", "0%"]
    )

    const barScale = useTransform(scrollYProgress, [0, 1], [0, 1])

    useMotionValueEvent(scrollYProgress, "change", (latest) => {
        const nextIndex = Math.min(process.length - 1, Math.floor(latest * process.length))
        setActiveIndex((current) => current === nextIndex ? current : nextIndex)
    })

    return (
        <section
            ref={sectionRef}
            className="process"
            id="about-process"
            data-scroll-section
            data-scroll-label="Rukopis"
            style={{ height: `${process.length * 100 + 50}vh`}}
        >
            <div className="sticky__container">
                <div className="sticky__images">
                    {process.map((item, index) => (
                        <ProcessImage
                            item={item}
                            index={index}
                            key={item.label}
                            imageProgress={scrollYProgress}
                        />
                    ))}
                </div>

                <motion.div
                    className="progess__bar"
                >
                    <motion.div
                        style={{
                            opacity: topBarOpacity,
                            top: topBarTop,
                        }}
                    >
                        <p className="process__eyebrow">03 · Cesta rukopisu</p>
                        <div className="progress__text">
                            {process.map((item, index) => (
                                <div className="progress__item" key={item.label}>
                                    <p
                                        className={index === activeIndex ? "is-active" : ""}
                                        aria-current={index === activeIndex ? "step" : undefined}
                                    >
                                        <span>0{index + 1}</span>
                                        {item.label}
                                    </p>
                                    {index < process.length - 1 && <div className="line"/>}
                                </div>
                            ))}
                        </div>
                        <div className="divider">
                            <motion.span style={{ scaleX: barScale }} />
                        </div>
                    </motion.div>

                    <div className="text__container">
                        {process.map((item, index) => (
                            <ProcessCopy
                                item={item}
                                index={index}
                                progress={scrollYProgress}
                                key={item.label}
                            />
                        ))}
                    </div>
                </motion.div>
            </div>

        </section>
    )
}
