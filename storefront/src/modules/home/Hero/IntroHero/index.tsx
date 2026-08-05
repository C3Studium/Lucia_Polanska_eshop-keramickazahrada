"use client";
import { Easing, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { useStateContext } from "@lib/context/StateContext";
import { urlFor } from "../../../../sanity/lib/image";
import WebButton from "@modules/common/components/Buttons/webButton";
import HeroImageShader from "./HeroImageShader";

const DEFAULT_CONTENT =
    "Za každým výrobkem je příběh\nKaždý výrobek tvořím ručně s respektem k materiálu, času i lidem.";

/**
 * Breaks the headline into two or three display lines at word boundaries, so the lockup stays
 * a tight block instead of one long line that shrinks to fit.
 */
function splitIntoLines(text: string) {
    const words = text.split(/\s+/).filter(Boolean);

    if (words.length <= 2) {
        return [text];
    }

    const lineCount = words.length >= 6 ? 3 : 2;
    const perLine = Math.ceil(words.length / lineCount);

    return Array.from({ length: lineCount }, (_, index) =>
        words.slice(index * perLine, (index + 1) * perLine).join(" ")
    ).filter(Boolean);
}

export default function IntroHero({
    data,
    newsText = "Dovolená | Novinky",
}: {
    data?: any
    newsText?: string
}) {
    const { firstLoad } = useStateContext();
    const ref = useRef<HTMLElement>(null);
    const pointerX = useMotionValue(0);
    const pointerY = useMotionValue(0);
    // Shader/cursor reduced-motion fallback is intentionally disabled for now.
    // const reduceMotion = useReducedMotion();
    const heroImage = data?.images?.[0]
        ? urlFor(data.images[0]).width(2400).quality(90).url()
        : "/assets/img/img/2.jpg";
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"]
    });

    const localJourneyProgress = useSpring(scrollYProgress, {
        stiffness: 82,
        damping: 26,
        mass: 0.42,
        restDelta: 0.0005,
    });
    const journeyProgress = localJourneyProgress;
    // The `content` field is authored with line breaks. Its first line is the promise, so it
    // becomes the display headline; whatever follows stays as the quiet lede. This keeps the
    // headline editable in Sanity without adding a field the CMS does not have yet.
    const contentLines = (data?.content ?? DEFAULT_CONTENT)
        .split("\n")
        .map((line: string) => line.trim())
        .filter(Boolean);
    const headlineSource = contentLines[0] ?? DEFAULT_CONTENT.split("\n")[0];
    // Authors write the promise as "..za každým mým výrobkem je příběh.." — the leading and
    // trailing ellipses are a body-copy mannerism that reads as a typo at display size.
    const headlineStripped = headlineSource.replace(/^[.\u2026\s]+|[.\u2026\s]+$/g, "");
    // Stripping the leading ellipsis leaves a lowercase first letter at display size.
    const headlineText =
        headlineStripped.charAt(0).toLocaleUpperCase("cs") + headlineStripped.slice(1);
    const headlineLines = splitIntoLines(headlineText);
    const ledeText = contentLines.slice(1).join(" ");
    const signature = [data?.title1 ?? "Lucie", data?.title2 ?? "Polanská"]
        .filter(Boolean)
        .join(" ");

    const y = useTransform(journeyProgress, [0, 1], ["-1.5%", "2.5%"]);
    const imageScale = useTransform(journeyProgress, [0, 1], [1.035, 1.09]);
    const nameY = useTransform(journeyProgress, [0, 0.7, 1], [0, -8, -34]);
    const nameScale = useTransform(journeyProgress, [0, 0.76, 1], [1, 0.99, 0.965]);
    const nameOpacity = useTransform(journeyProgress, [0, 0.82, 1], [1, 1, 0]);
    const contentOpacity = useTransform(journeyProgress, [0, 0.78, 1], [1, 1, 0]);
    const contentY = useTransform(journeyProgress, [0, 0.78, 1], [0, -4, -22]);
    const chromeOpacity = useTransform(journeyProgress, [0, 0.84, 1], [1, 1, 0]);
    // Parallax is driven by the hero's own scroll: over the first screenful the page-wide kiln
    // journey barely advances, so tying text depth to it made the effect invisible. The two
    // masses travel at different rates, which is what actually reads as depth.
    const headlineParallax = useTransform(localJourneyProgress, [0, 1], ["0%", "-62%"]);
    const ledeParallax = useTransform(localJourneyProgress, [0, 1], ["0%", "-18%"]);

    // const PreloaderAnimSVG = {
    //     start: {
            
            
    //     },
    //     enter: {
            
    //         transition: {
    //             duration: 0.75,
    //             delay: firstLoad ? 2 : 0,
    //             ease: [0.76, 0, 0.24, 1],
    //         }
    //     }
    // }
    const PreloaderAnimImage = {
        initial: {
            blur: "10px",
        },
        start: {
            blur: "10px",
            transition: {
                duration: 0.75,
                delay: 0.25,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        },
        enter: {
            blur: "0px",
            transition: {
                duration: 0.75,
                delay: !firstLoad ? 0.25 : 0,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }
    const PreloaderAnimImage2 = {
        initial: {
            clipPath: "inset(0 0 100% 0)",
            scale: 1.06,
        },
        start: {
            clipPath: "inset(0 0 100% 0)",
            scale: 1.06,
            transition: {
                duration: 1.1,
                delay: 0.25,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        },
        enter: {
            clipPath: "inset(0 0 0% 0)",
            scale: 1,
            transition: {
                duration: 1.1,
                delay: !firstLoad ? 0.25 : 0,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }
    const PreloaderAnimUpdates = {
        initial: {
            y: "100%",
        },
        start: {
            y: "100%",
        },
        enter: {
            y: "0%",
            transition: {
                duration: 0.75,
                delay: !firstLoad ? 1.25 : 0,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }
    const PreloaderAnimButton = {
        initial: {
            opacity: 0,
            y: 20,
        },
        start: {
            opacity: 0,
            y: 20,
        },
        enter: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                delay: !firstLoad ? 1.35 : 0.5,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }

    return (
        <section
          className="Hero__Intro__Journey"
          ref={ref}
        >
          <div
            className="Hero__Intro"
            onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                pointerX.set((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5);
                pointerY.set((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5);
            }}
            onPointerLeave={() => {
                pointerX.set(0);
                pointerY.set(0);
            }}
        >
            <motion.div
                className="Hero__Intro__Topline"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: firstLoad ? 0.15 : 0.85 }}
                style={{ opacity: chromeOpacity }}
            >
                <span>Autorská keramika</span>
                <span className="line" />
                <span>Písek · od roku 2014</span>
            </motion.div>
            <div className="Hero__Intro__Img">
                {/* <motion.div 
                    className="Hero__Intro__Img__inner"
                    initial="initial"
                    animate="enter"
                    exit="exit"
                    variants={PreloaderAnimImage}
                    style={{ transformOrigin: "bottom center"}}
                >
                    <Image 
                        src={"/assets/img/11.jpg"}
                        alt="Intro Image"
                        sizes="50dvw"
                        fill={true}
                    />
                </motion.div> */}
            </div>
            <motion.div
                className="Hero__Intro__Header"
                style={{ y: nameY, scale: nameScale, opacity: nameOpacity }}
            >
                <span className="Hero__Intro__Eyebrow">Objekty s vlastním příběhem</span>

                {/* One h1, and it carries the promise rather than the name: a visitor arrives
                    looking for ceramics, not for a person. The first line of the Sanity `content`
                    field is the headline, so Lucia still edits it; the rest becomes the lede. */}
                <motion.h1 className="Hero__Intro__Headline" style={{ y: headlineParallax }}>
                    {headlineLines.map((line, index) => (
                        <MaskedLine
                            key={line + index}
                            text={line}
                            delay={0.35 + index * 0.14}
                        />
                    ))}
                </motion.h1>

                <motion.p className="Hero__Intro__Signature" style={{ y: headlineParallax }}>
                    <MaskedLine text={`— ${signature}`} delay={0.35 + headlineLines.length * 0.14} />
                </motion.p>

                <motion.div
                    className="Hero__Intro__Lede"
                    style={{ opacity: contentOpacity, y: ledeParallax }}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.9, ease: [0.76, 0, 0.24, 1] as Easing }}
                >
                    {ledeText && <p>{ledeText}</p>}
                    <div className="Hero__Intro__Header__Cta">
                        <WebButton
                            href="/store"
                            title="Prohlédnout objekty"
                            Kind="Link"
                            tone="dark"
                        />
                    </div>
                </motion.div>
            </motion.div>
            <motion.div
                className="Hero__Intro__Image__wrapper"
            >
                <motion.div 
                    className="Hero__Intro__Cover"
                    initial="initial"
                    animate="enter"
                    exit="exit"
                    variants={PreloaderAnimImage}
                    style={{ y, scale: imageScale }}
                >
                    <motion.div
                        className="Hero__Intro__Cover__Image"
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        variants={PreloaderAnimImage2}
                        style={{ width: "100%", height: "100%", position: "relative", transformOrigin: "center center" }}
                    >
                        <HeroImageShader
                            src={heroImage}
                            pointerX={pointerX}
                            pointerY={pointerY}
                        />
                    </motion.div>
                </motion.div>
            </motion.div>
            <motion.div className="Hero__Intro__FooterRail" style={{ opacity: chromeOpacity }}>
                <motion.div
                    className="Hero__Intro__Updates"
                    initial="initial"
                    animate="enter"
                    exit="exit"
                    variants={PreloaderAnimUpdates}
                    custom={2}
                >
                    <p>{newsText || "Dovolena | Novinky"}</p>
                </motion.div>
                <motion.div
                    className="Hero__Intro__ScrollCue"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.65, delay: firstLoad ? 0.35 : 1.2 }}
                >
                    <span>Pokračovat</span>
                    <i aria-hidden="true" />
                </motion.div>
                <motion.div
                    className="Hero__Intro__ObjectCount"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.65, delay: firstLoad ? 0.3 : 1.1 }}
                >
                    <span>01</span>
                    <span>Ručně · pomalu · v malém počtu</span>
                </motion.div>
            </motion.div>
          </div>
        </section>
    )
}


/**
 * One headline line, revealed from behind a mask. Replaces the per-character fade: characters
 * were inline-block spans, which collapsed spaces and read as a shimmer rather than a reveal.
 * A masked line is the site's own clip-reveal language and arrives as one considered movement.
 */
function MaskedLine({
    text,
    delay = 0,
    className,
}: {
    text: string
    delay?: number
    className?: string
}) {
    const reduceMotion = useReducedMotion()

    return (
        <span className={`maskedLine ${className ?? ""}`}>
            <motion.span
                className="maskedLineInner"
                initial={reduceMotion ? { y: "0%" } : { y: "115%" }}
                animate={{ y: "0%" }}
                transition={{
                    duration: reduceMotion ? 0 : 1.05,
                    delay: reduceMotion ? 0 : delay,
                    ease: [0.76, 0, 0.24, 1] as Easing,
                }}
            >
                {text}
            </motion.span>
        </span>
    );
}



const wordSplit = (text: string, firstLoad: boolean) => {
    const PreloaderAnimText = {
        start: {
            opacity: 0,
            y: 20,
        },
        enter: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                delay: !firstLoad ? 1.05 + (i * 0.018) : 0.5 + (i * 0.01),
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        })
    }
    return text.split(' ').map((word, index) => (
        <motion.span 
            key={index}
            initial="start"
            animate="enter"
            exit="exit"
            variants={PreloaderAnimText}
            custom={index}
            style={{ display: "inline-block", whiteSpace: "pre", marginRight: "0.25rem" }}
        >
            {word}
        </motion.span>
    ));
}

const textWithBreaks = (text: string, firstLoad: boolean) => {
    const PreloaderAnimText = {
        start: {
            opacity: 0,
            y: 20,
        },
        enter: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                delay: !firstLoad ? 1.05 + (i * 0.018) : 0.5 + (i * 0.01),
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        })
    }

    // Split by line breaks first, then by spaces
    return text.split('\n').map((line, lineIndex) => (
        <span key={lineIndex} style={{ display: "flex", flexWrap: "wrap" }}>
            {line.split(' ').map((word, wordIndex) => {
                const globalIndex = lineIndex * 100 + wordIndex; // Simple way to create unique indices
                return (
                    <motion.span
                        key={wordIndex}
                        initial="start"
                        animate="enter"
                        exit="exit"
                        variants={PreloaderAnimText}
                        custom={globalIndex}
                        style={{ display: "inline-block", whiteSpace: "pre" }}
                    >
                        {word + " "}
                    </motion.span>
                );
            })}
            {lineIndex < text.split('\n').length - 1 && <br />}
        </span>
    ));
}
