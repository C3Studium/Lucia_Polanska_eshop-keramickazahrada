"use client";
import { MotionValue, useScroll, useTransform, motion, useInView, Easing } from "framer-motion";
import Image from "next/image";
import {useRef, useState, useEffect } from "react";
import { client } from "../../../../sanity/lib/client";
import { urlFor } from "../../../../sanity/lib/image";
import CTA from "../CTA";
import MouseAnim from "@modules/common/components/MouseAnim";

export default function About() {
    return (
        <section className="kurzy__about">
            <div className="children"> 
                <div className="intro">
                    <div className="text">
                        <div className="text__wrapper">
                            <h3>
                                MOMENTÁLNĚ DĚLÁM KERAMICKÉ KURZY PRO DĚTI JSOU MÍSTEM, KDE SE TVOŘENÍ PŘIROZENĚ PROPOJUJE S KLIDEM, SOUSTŘEDĚNÍM A RADOSTÍ Z PRÁCE RUKAMA. HLÍNA ROZVÍJÍ JEMNOU MOTORIKU, KOORDINACI, FANTAZII I SCHOPNOST SPOLUPRACOVAT, A PŘITOM NENÁSILNĚ UČÍ TRPĚLIVOSTI A DOKONČOVÁNÍ VLASTNÍ PRÁCE.
                            </h3>
                        </div>
                    </div>
                    <div className="Images">
                        <div className="Images__container">
                            <div className="Image__wrapper">
                                <Image src="/assets/img/roller/1h.jpg" alt="Kurzy image" fill/>
                            </div>
                            <div className="Image__wrapper">
                                <Image src="/assets/img/roller/1v.jpg" alt="Kurzy image" fill/>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="cta">
                    <div className="text">
                        <h3>
                            ZAČÍNÁME OD ÚPLNÝCH ZÁKLADŮ. DĚTI POZNAJÍ RŮZNÉ DRUHY HLÍNY, NÁSTROJE I JEDNODUCHÉ TECHNIKY MODELOVÁNÍ, SVÉ VÝROBKY OZDOBÍ BARVAMI A GLAZURAMI A ODNESOU SI DOMŮ SKUTEČNÝ, TRVALÝ VÝSLEDEK. PRACUJI V MALÝCH SKUPINÁCH, S INDIVIDUÁLNÍM PŘÍSTUPEM A DŮRAZEM NA KVALITU.
                        </h3>
                        <CTA kind="primary" text="Zájem o kurzy"/>
                    </div>
                    <div className="image__container">
                        <div className="image__wrapper">
                            <Image src="/assets/img/roller/2h.jpg" alt="Kurzy image" fill/>
                        </div>
                    </div>
                </div>
            </div>
            <div className="adults">
                <div className="main">
                    <div className="mouseanim">
                        <MouseAnim />
                        <p>Kurzy pro dospělé dole</p>
                    </div>
                    <div className="Video">
                        <Image src="/assets/img/roller/2v.jpg" alt="Kurzy video" fill/>
                    </div>
                </div>
                <div className="text">
                    <p>
                        KURZY KERAMIKY PRO DOSPĚLÉ BUDOU PROSTOREM PRO ZPOMALENÍ, SOUSTŘEDĚNÍ A NÁVRAT K RUČNÍ PRÁCI. HLÍNA ZDE NEBUDE JEN MATERIÁLEM, ALE I CESTOU K TICHU, ROVNOVÁZE A RADOSTI Z VLASTNÍHO TVOŘENÍ. ZATÍM VE VÝVOJI . . .
                    </p>
                </div>
                <CTA kind="primary" text="Zájem o kurzy" />
            </div>
        </section>
    )
}