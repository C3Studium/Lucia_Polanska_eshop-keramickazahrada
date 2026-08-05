"use client";
import { useInView, motion, Easing } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { urlFor } from "../../../../../sanity/lib/image";

export default function Intro ({
    data,
    active,
}: {
    data?: any
    active?: boolean
}) {
    const ref = useRef<HTMLDivElement>(null);
    const observedInView = useInView(ref, {
        once: true,  
        margin: "-50px",    
        amount: 0.05,        
    });
    const isInView = active ?? observedInView;
    const imageAnim = {
        start: {
            opacity: 0,
            width: "0%",
        },
        enter: {
            opacity: 1,
            width: "clamp(12rem, 21vw, 28rem)",
            transition: {
                duration: 1.05,
                delay: 0.75,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }
    return (
        <section className="ECom__Intro" ref={ref}>
            <div className="ECom__Intro__Rail" aria-hidden="true">
                <span>01 · Keramická zahrada</span>
                <span className="rail__line" />
                <span>Objekty s vlastním příběhem</span>
            </div>
            <div className="ECom__Intro__Title">
                <h2>
                    {charSplit(data?.title1 || "Vítejte", isInView)}
                </h2>
                <div className="Hero__Intro__Container">
                    <motion.div 
                        className="Hero__Intro__Img_Wrapper"
                        style={styleObj}
                        animate={isInView ? "enter" : "start"}
                        variants={imageAnim}
                    >
                        <div
                            className="Hero__Intro__Img__Container">
                            <Image 
                                src={data?.image ? urlFor(data.image).url() : "/assets/img/img/3.jpg"}
                                alt="Intro Image"
                                fill={true}
                                sizes="40dvw"
                                priority={true}
                                className="Hero__Intro__Img"
                            />
                        </div>
                    </motion.div>
                    <h2>
                        {charSplit(data?.title2 || "v Keramické", isInView)}
                    </h2>
                </div>
                <h2>
                    {charSplit(data?.title3 || "Zahradě", isInView)}
                </h2>
            </div>
            <div className="ECom__Intro__Content">
                <p>
                    {data?.content1 ? textWithBreaks(data.content1, isInView) : wordSplit("Objevte svět ručně vyráběné keramiky, kde každý kousek nese osobní příběh, každý výrobek je originál.", isInView)}
                </p>
                <p className="ECom__Intro__Aside">
                    {data?.content2
                        ? textWithBreaks(data.content2, isInView)
                        : wordSplit("Pro zahradu i domov. Vytvořeno pomalu, rukama a v malém počtu.", isInView)}
                </p>
            </div>
        </section>
    );
}


const wordSplit = (text: string, isInView: boolean) => {
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
                delay: 0.15 + (i * 0.05),
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        })
    }
    return text.split(' ').map((word, index) => (
        <motion.span 
            key={index}
            animate={isInView ? "enter" : "start"}
            variants={PreloaderAnimText}
            custom={index}
            style={styleObj2}
        >
            {word}
        </motion.span>
    ));
}

const textWithBreaks = (text: string, isInView: boolean) => {
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
                delay: 0.15 + (i * 0.05),
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        })
    }

    // Split by line breaks first, then by spaces
    return text.split('\n').map((line, lineIndex) => (
        <span key={lineIndex} style={styleObj3}>
            {line.split(' ').map((word, wordIndex) => {
                const globalIndex = lineIndex * 100 + wordIndex; // Simple way to create unique indices
                return (
                    <motion.span
                        key={wordIndex}
                        animate={isInView ? "enter" : "start"}
                        variants={PreloaderAnimText}
                        custom={globalIndex}
                        style={styleObj4}
                    >
                        {word + " "}
                    </motion.span>
                );
            })}
            {lineIndex < text.split('\n').length - 1 && <br />}
        </span>
    ));
}

const charSplit = (text: string, isInView: boolean) => {
    const charAnim = {
        start: {
            opacity: 0,
            y: 20,
        },
        enter: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                delay: 0.25 + (i * 0.05),
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        })
    } 

    return text.split('').map((char, index) => (
        <motion.span 
            key={index}
            animate={isInView ? "enter" : "start"}
            variants={charAnim}
            custom={index}
            className="precise__char"
        >
            {char === " " ? "\u00A0" : char}
        </motion.span>
    ));
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { transformOrigin: "left center" as const, overflow: "hidden" as const }
const styleObj2 = { display: "inline-block" as const, whiteSpace: "pre" as const, marginRight: "0.25em" as const }
const styleObj3 = { display: "inline" as const }
const styleObj4 = { display: "inline-block" as const, whiteSpace: "pre" as const,}
