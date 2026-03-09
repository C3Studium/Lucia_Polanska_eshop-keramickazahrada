"use client";
import { useInView, motion, Easing } from "framer-motion";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import { client } from "../../../../../sanity/lib/client";
import { urlFor } from "../../../../../sanity/lib/image";

export default function Intro () {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, {
        once: true,  
        margin: "-50px",    
        amount: 0.05,        
    });
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            const ecomIntroData = await client.fetch('*[_type == "ecomIntro"][0]');
            setData(ecomIntroData);
        };
        fetchData();
    }, []);

    const imageAnim = {
        start: {
            opacity: 0,
            width: "0%",
        },
        enter: {
            opacity: 1,
            width: "auto",
            transition: {
                duration: 0.75,
                delay: 1.5,
                ease: [0.76, 0, 0.24, 1] as Easing,
            }
        }
    }
    return (
        <section className="ECom__Intro" ref={ref}>
            <div className="ECom__Intro__Title">
                <h2>
                    {charSplit(data?.title1 || "Vítejte", isInView)}
                </h2>
                <div className="Hero__Intro__Container">
                    <motion.div 
                        className="Hero__Intro__Img_Wrapper"
                        style={{ transformOrigin: "left center", overflow: "hidden" }}
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
            style={{ display: "inline-block", whiteSpace: "pre", marginRight: "0.25em" }}
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
        <span key={lineIndex} style={{ display: "inline" }}>
            {line.split(' ').map((word, wordIndex) => {
                const globalIndex = lineIndex * 100 + wordIndex; // Simple way to create unique indices
                return (
                    <motion.span
                        key={wordIndex}
                        animate={isInView ? "enter" : "start"}
                        variants={PreloaderAnimText}
                        custom={globalIndex}
                        style={{ display: "inline-block", whiteSpace: "pre",}}
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
