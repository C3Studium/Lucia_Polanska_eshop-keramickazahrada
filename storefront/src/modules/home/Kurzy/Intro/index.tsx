"use client";

import MouseAnim from "@modules/common/components/MouseAnim";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import { client } from "../../../../sanity/lib/client";
import { urlFor } from "../../../../sanity/lib/image";

export default function Intro() {
    const textRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            const kurzyIntroData = await client.fetch('*[_type == "kurzyIntro"][0]');
            setData(kurzyIntroData);
        };
        fetchData();
    }, []);

    const { scrollYProgress } = useScroll({
        target: textRef,
        offset: ["start 0.25", "end end"]
    });

    const { scrollYProgress: ImageScrollYProgress } = useScroll({
        target: imageRef,
        offset: ["start end", "end 0.3"]
    });

    const image1 = useTransform(ImageScrollYProgress, [0, 0.2, 0.7, 0.8 ], ["0%", "17.5dvw", "17.5dvw", '0%']);
    const image2 = useTransform(ImageScrollYProgress, [0, 0.2, 0.4, 0.8, 0.9], ["0%", "0%", "17.5dvw", "17.5dvw", "0%"]);
    const image3 = useTransform(ImageScrollYProgress, [0, 0.4, 0.6, 0.9, 1], ["0%", "0%", "17.5dvw", "17.5dvw", "0%"]);



    // might consider insead of inView, using scrollYProgress for more control over animation - text opacity
    return (
        <section className="kurzy__intro" ref={textRef} id="kurzy">
            <div className="kurzy__intro__bgImages">
                <div className="kurzy__intro__Gradient">
                    <svg width={1182} height={1118} viewBox="0 0 1182 1118" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g filter="url(#filter0_f_1099_194)">
                            <path d="M665.894 600.007C701.887 608.096 754.931 717.024 618.533 717.024C601.275 717.024 539.174 708.499 539.169 631.257C539.169 613.998 573.811 571.154 591.069 571.154C608.328 571.154 640.319 585.363 665.894 600.007Z" fill="#ff7000bf" fillOpacity="0.5"/>
                            <path d="M740.718 534.27C776.712 542.358 829.755 651.287 693.358 651.287C676.099 651.287 613.998 642.762 613.994 565.52C613.994 548.261 766.299 621.356 665.894 505.417C683.152 505.417 715.143 519.625 740.718 534.27Z" fill="#ff7000bf" fillOpacity="0.5"/>
                            <path d="M547.848 462.385C583.842 470.474 616.605 666.221 480.208 666.221C462.949 666.221 400.849 657.696 400.844 580.454C400.844 563.195 402.717 484.171 419.976 484.171C437.235 484.171 565.287 389.775 547.848 462.385Z" fill="#ff7000bf" fillOpacity="0.5"/>
                            <path d="M683.275 436.704C719.268 444.792 772.312 553.721 635.915 553.721C618.656 553.721 556.555 545.196 556.55 467.954C556.55 450.695 591.192 407.851 608.451 407.851C625.709 407.851 694.077 379.889 683.275 436.704Z" fill="#ff7000bf" fillOpacity="0.5"/>
                        </g>
                        <defs>
                            <filter id="filter0_f_1099_194" x="0.84375" y="0.970703" width="1180.86" height="1116.05" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                            <feGaussianBlur stdDeviation="40" result="effect1_foregroundBlur_1099_194"/>
                            </filter>
                        </defs>
                    </svg>
                </div>
                <div className="kurzy__intro__Gradient">
                    <svg width={1182} height={1118} viewBox="0 0 1182 1118" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g filter="url(#filter0_f_1099_194)">
                            <path d="M665.894 600.007C701.887 608.096 754.931 717.024 618.533 717.024C601.275 717.024 539.174 708.499 539.169 631.257C539.169 613.998 573.811 571.154 591.069 571.154C608.328 571.154 640.319 585.363 665.894 600.007Z" fill="#ff7000bf" fillOpacity="0.5"/>
                            <path d="M740.718 534.27C776.712 542.358 829.755 651.287 693.358 651.287C676.099 651.287 613.998 642.762 613.994 565.52C613.994 548.261 766.299 621.356 665.894 505.417C683.152 505.417 715.143 519.625 740.718 534.27Z" fill="#ff7000bf" fillOpacity="0.5"/>
                            <path d="M547.848 462.385C583.842 470.474 616.605 666.221 480.208 666.221C462.949 666.221 400.849 657.696 400.844 580.454C400.844 563.195 402.717 484.171 419.976 484.171C437.235 484.171 565.287 389.775 547.848 462.385Z" fill="#ff7000bf" fillOpacity="0.5"/>
                            <path d="M683.275 436.704C719.268 444.792 772.312 553.721 635.915 553.721C618.656 553.721 556.555 545.196 556.55 467.954C556.55 450.695 591.192 407.851 608.451 407.851C625.709 407.851 694.077 379.889 683.275 436.704Z" fill="#ff7000bf" fillOpacity="0.5"/>
                        </g>
                        <defs>
                            <filter id="filter0_f_1099_194" x="0.84375" y="0.970703" width="1180.86" height="1116.05" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                            <feGaussianBlur stdDeviation="40" result="effect1_foregroundBlur_1099_194"/>
                            </filter>
                        </defs>
                    </svg>
                </div>
            </div>
            <div className="kurzy__intro__sticky">
                <div className="kurzy__intro__title" ref={imageRef}>
                    <div className="kurzy__intro__title__details">
                        <div className="kurzy__intro__title__details__title">
                            <span>
                                Ku
                            </span>
                        </div>
                        <motion.div className="kurzy__intro__title__details__img__inner" style={{ width: image1 }}>
                            <Image
                                src={data?.images?.[0] ? urlFor(data.images[0]).url() : "/assets/img/img/2.jpg"}
                                alt="Intro Details"
                                fill={true}
                                sizes="50dvw"
                                priority
                            />
                        </motion.div>
                        <div className="kurzy__intro__title__details__title">
                            <span>
                                rzy
                            </span>
                        </div>
                    </div>
                    <div className="kurzy__intro__title__details">
                        <div className="kurzy__intro__title__details__title">
                            <span>
                                Kur
                            </span>
                        </div>
                        <motion.div className="kurzy__intro__title__details__img__inner" style={{ width: image2 }}>
                            <Image
                                src={data?.images?.[1] ? urlFor(data.images[1]).url() : "/assets/img/img/3.jpg"}
                                alt="Intro Details"
                                fill={true}
                                sizes="50dvw"
                                priority
                            />
                        </motion.div>
                        <div className="kurzy__intro__title__details__title">
                            <span>
                                zy
                            </span>
                        </div>
                    </div>
                    <div className="kurzy__intro__title__details">
                        <div className="kurzy__intro__title__details__title">
                            <span>
                                Kurz
                            </span>
                        </div>
                        <motion.div className="kurzy__intro__title__details__img__inner" style={{ width: image3 }}>
                            <Image
                                src={data?.images?.[2] ? urlFor(data.images[2]).url() : "/assets/img/img/5.jpg"}
                                alt="Intro Details"
                                fill={true}
                                sizes="50dvw"
                                priority
                            />
                        </motion.div>
                        <div className="kurzy__intro__title__details__title">
                            <span>
                                y
                            </span>  
                        </div>
                    </div>
                </div>
                <div className="kurzy__intro__content">
                    <div className="kurzy__intro__content__text">
                        <p>
                            <WordSplit text={data?.content || "Chcete si opravdu vyrobit to, co právě obdivujete v mém krámku? Nebo hledáte nový koníček, který vás přivede k tichu a radosti z vlastních rukou? V mých keramických kurzech vás provedu celým procesem – od výběru hlíny, přes modelaci a práci na kruhu až po glazování a výpal. Přidejte se k malým skupinám, vytvořte si originální kousek a odnesete si domů zážitek, nikoli jen výrobek."} scrollYProgress={scrollYProgress} />
                        </p>
                        <div className="kurzy__intro__content__mouse">
                            <MouseAnim />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

const WordSplit = ({ text, scrollYProgress}: { text: string, scrollYProgress: MotionValue<number> }) => {
    const word = text.split(' ')
    return (
        <>
            {word.map((w, index) => {
                const start = index / word.length;
                const end = start + (1 / word.length);
                const range: [number, number] = [start, end];
                return(
                    <Word key={index} scrollYProgress={scrollYProgress} range={range}>
                        {w + " "}
                    </Word>
                )
            })}
        </>
    )
}

const Word = ({ scrollYProgress, children, range }: { scrollYProgress: MotionValue<number>, children: string, range: [number, number] }) => {

    const opacity = useTransform(scrollYProgress, range, [0.25, 1]);
    return (
        <motion.span style={{ display: "inline-block", whiteSpace: "pre", opacity }}>
            {children}
        </motion.span>
    );
}