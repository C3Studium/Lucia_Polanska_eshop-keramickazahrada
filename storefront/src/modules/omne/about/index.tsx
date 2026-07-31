"use client"

import WebButton from "@modules/common/components/Buttons/webButton"
import {
    motion,
    useMotionValue,
    useScroll,
    useSpring,
    useTransform,
    type MotionValue,
} from "framer-motion"
import Image from "next/image"
import { useRef } from "react"

type IconToken = {
    type: "icon"
    name: "study" | "pot" | "dash" | "cube"
    src: string
}
type CopyItem = string | IconToken
type CopyLine = CopyItem[]
type Token = {
    type: "word" | "space" | "punctuation" | "icon"
    value?: string
    icon?: IconToken
}

const rootsCopy: CopyLine[] = [
    [
        "JSEM Písecká rodačka,",
        { type: "icon", name: "study", src: "/assets/icons/study.png" },
        "ABSOLVENTKA",
    ],
    ["SPŠ KERAMICKÉ V BECHYNI A MÁMA DVOU"],
    [
        "ÚŽASNÝCH DĚTÍ. NAPLNO SE",
        { type: "icon", name: "pot", src: "/assets/icons/pot.png" },
        "KERAMICE",
    ],
    ["VĚNUJI od roku 2014."],
]

const signatureCopy: CopyLine[] = [
    ["SVOU ORIGINÁLNÍ POETIKOU"],
    [
        { type: "icon", name: "dash", src: "/assets/icons/dash.png" },
        "A přírodním designem",
    ],
    [
        "I VOLBOU VYSOCE KVALITNÍCH",
        { type: "icon", name: "cube", src: "/assets/icons/cube.png" },
        "MATERIÁLŮ",
    ],
    ["MÁ KERAMIKA OSLOVÍ KAŽDÉHO,"],
    ["KDO HLEDÁ VÝTVARNOU I řemeslnou kvalitu."],
]

const splitCopy = (lines: CopyLine[]): Token[][] =>
    lines.map((line) =>
        line.flatMap((item) => {
            if (typeof item !== "string") {
                return [{ type: "icon" as const, icon: item }]
            }

            return item
                .split(/(\s+|[,.])/)
                .filter(Boolean)
                .map((value): Token => ({
                    type: /^\s+$/.test(value)
                        ? "space"
                        : /^[,.]$/.test(value)
                            ? "punctuation"
                            : "word",
                    value,
                }))
        })
    )

const getCopyLabel = (lines: CopyLine[]) =>
    lines
        .map((line) =>
            line
                .filter((item): item is string => typeof item === "string")
                .join(" ")
        )
        .join(" ")

const easeOut = (value: number) => 1 - Math.pow(1 - value, 3)
const revealEase = (value: number) => 1 - Math.pow(1 - value, 4)
const accentWords = new Set([
    "písecká",
    "rodačka",
    "od",
    "roku",
    "2014",
    "přírodním",
    "designem",
    "řemeslnou",
    "kvalitu",
])

function getTokenRange(index: number, total: number): [number, number] {
    const step = 1 / Math.max(total, 1)
    const start = index * step
    return [start, Math.min(start + Math.max(step * 4, .1), 1)]
}

function AnimatedWord({
    value,
    index,
    total,
    progress,
    punctuation,
}: {
    value: string
    index: number
    total: number
    progress: MotionValue<number>
    punctuation?: boolean
}) {
    const [start, end] = getTokenRange(index, total)
    const opacity = useTransform(progress, [start, end], [.1, 1], { ease: easeOut })
    const isAccent = accentWords.has(value.toLocaleLowerCase("cs-CZ"))

    return (
        <motion.span
            className={[
                "story__word",
                punctuation ? "story__word--punctuation" : "",
                isAccent ? "text__accent" : "",
            ].filter(Boolean).join(" ")}
            style={{ opacity }}
        >
            {Array.from(value).map((character, characterIndex) => (
                <span className="story__char" key={`${character}-${characterIndex}`}>
                    {character}
                </span>
            ))}
        </motion.span>
    )
}

function AnimatedIcon({
    icon,
    index,
    total,
    progress,
}: {
    icon: IconToken
    index: number
    total: number
    progress: MotionValue<number>
}) {
    const [start, end] = getTokenRange(index, total)
    const opacity = useTransform(progress, [start, end], [.1, 1], { ease: easeOut })
    const scale = useTransform(progress, [start, end], [.45, 1], { ease: easeOut })

    return (
        <motion.span
            className={`inline__icon inline__icon--${icon.name}`}
            style={{ opacity, scale, transformOrigin: "center center" }}
        >
            <Image src={icon.src} alt="" width={40} height={40}/>
        </motion.span>
    )
}

function AnimatedCopy({
    copy,
    signature,
}: {
    copy: CopyLine[]
    signature?: boolean
}) {
    const textRef = useRef<HTMLParagraphElement>(null)
    const tokens = splitCopy(copy)
    const total = tokens.flat().length
    const { scrollYProgress } = useScroll({
        target: textRef,
        offset: ["start end", "end 0.75"],
    })
    let tokenIndex = 0

    return (
        <p ref={textRef} aria-label={getCopyLabel(copy)}>
            {tokens.map((line, lineIndex) => (
                <span
                    className={
                        signature
                            ? `line__mask signature__line signature__line--${lineIndex + 1}`
                            : "line__mask"
                    }
                    aria-hidden="true"
                    key={`line-${lineIndex}`}
                >
                    <span className="story__line">
                        {line.map((token, indexWithinLine) => {
                            const currentIndex = tokenIndex
                            tokenIndex += 1

                            if (token.type === "space") {
                                return (
                                    <span className="story__space" key={`space-${indexWithinLine}`}>
                                        {token.value}
                                    </span>
                                )
                            }

                            if (token.type === "icon" && token.icon) {
                                return (
                                    <AnimatedIcon
                                        icon={token.icon}
                                        index={currentIndex}
                                        total={total}
                                        progress={scrollYProgress}
                                        key={`${token.icon.name}-${indexWithinLine}`}
                                    />
                                )
                            }

                            return (
                                <AnimatedWord
                                    value={token.value ?? ""}
                                    index={currentIndex}
                                    total={total}
                                    progress={scrollYProgress}
                                    punctuation={token.type === "punctuation"}
                                    key={`${token.value}-${indexWithinLine}`}
                                />
                            )
                        })}
                    </span>
                </span>
            ))}
        </p>
    )
}

export default function AboutInfo () {
    const sectionRef = useRef<HTMLElement>(null)
    const imageRef = useRef<HTMLDivElement>(null)
    const pointerX = useMotionValue(0)
    const pointerY = useMotionValue(0)
    const smoothX = useSpring(pointerX, { stiffness: 140, damping: 22, mass: .45 })
    const smoothY = useSpring(pointerY, { stiffness: 140, damping: 22, mass: .45 })
    const { scrollYProgress: imageProgress } = useScroll({
        target: imageRef,
        offset: ["0 0.74", "1 0.18"],
    })
    const { scrollYProgress: sectionProgress } = useScroll({
        target: sectionRef,
        offset: ["0 0.85", "1 0.15"],
    })

    const rootsY = useTransform(
        sectionProgress,
        [0, .6, 1],
        [20, -80, -140],
        { ease: easeOut }
    )
    const imageY = useTransform(
        sectionProgress,
        [.08, .62, 1],
        [50, 0, -110],
        { ease: easeOut }
    )
    const signatureY = useTransform(
        sectionProgress,
        [.2, .72, 1],
        [35, -120, -200],
        { ease: easeOut }
    )
    const imageScale = useTransform(
        imageProgress,
        [0, 1],
        [1.1, 1],
        { ease: easeOut }
    )

    const curtainClip = useTransform(
        imageProgress,
        [.06, .78],
        ["inset(0% 0 0 0)", "inset(100% 0 0 0)"],
        { ease: revealEase }
    )

    const rootsOpacity = useTransform(
        sectionProgress,
        [0, .1, .9, 1],
        [0, 1, 1, 0],
        { ease: easeOut }
    )
    const imageOpacity = useTransform(
        sectionProgress,
        [.3, .72, .9],
        [1, 1, 0]
    )
    const signatureOpacity = useTransform(
        sectionProgress,
        [.68, .93, 1],
        [1, 1, .15]
    )
    const imageSettleY = useTransform(
        imageProgress,
        [.06, .9],
        [12, 0],
        { ease: revealEase }
    )

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
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
        <section
            ref={sectionRef}
            className="AboutInfo"
            id="about-story"
            data-scroll-section
            data-scroll-label="Příběh"
        >
            <motion.div
                className="text__container text__container--roots"
                style={{ y: rootsY, opacity: rootsOpacity }}
            >
                <p className="aboutInfo__label">01 · Kořeny</p>
                <div className="first__text">
                    <AnimatedCopy copy={rootsCopy}/>
                </div>

                <div className="divider__container">
                    <div className="divider"/>
                    <div className="buttons">
                        <p>
                            Chcete vidět, jak<br/>
                            vznikají mé výrobky?
                        </p>
                        <WebButton title="Výroba" Kind="Link" href="/vyroba"/>
                    </div>
                </div>
            </motion.div>

            <motion.div
                className="Image__container"
                style={{ y: imageY, opacity: imageOpacity }}
                onPointerMove={handlePointerMove}
                onPointerLeave={resetPointer}
            >
                <div
                    ref={imageRef}
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
                                src="/assets/img/ome/3.png"
                                alt="Lucie při ruční výrobě keramiky"
                                fill
                                sizes="(max-width: 720px) 86vw, 875px"
                            />
                        </motion.div>
                    </motion.div>
                    <span className="image__note">
                        <small>Ateliér · Písek</small>
                        Ručně, pomalu,<br/>s respektem k materiálu
                    </span>
                    <motion.div
                        className="image__curtain"
                        style={{ clipPath: curtainClip }}
                        aria-hidden="true"
                    />
                </div>
            </motion.div>

            <motion.div
                className="text__container text__container--signature"
                style={{ y: signatureY, opacity: signatureOpacity }}
            >
                <p className="aboutInfo__label">02 · Rukopis</p>
                <div className="first__text">
                    <AnimatedCopy copy={signatureCopy} signature/>
                </div>

                <div className="divider__container">
                    <div className="divider"/>
                </div>
            </motion.div>
        </section>
    )
}
