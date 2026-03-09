"use client";
import { useState, useEffect } from "react";
import About from "./About";
import CTA from "./CTA";
import Intro from "./Intro";
import { client } from "../../../sanity/lib/client";

export default function Kurzy() {
    const [settings, setSettings] = useState<any>(null);

    // useEffect(() => {
    //     const fetchSettings = async () => {
    //         const mainSettings = await client.fetch('*[_type == "mainPageSettings"][0]');
    //         setSettings(mainSettings);
    //     };
    //     fetchSettings();
    // }, []);

    // const kurzyEnabled = settings?.kurzySection?.enabled !== false;
    // const introEnabled = settings?.kurzySection?.intro !== false;
    // const aboutEnabled = settings?.kurzySection?.about !== false;
    // const ctaEnabled = settings?.kurzySection?.cta !== false;

    // if (!kurzyEnabled) {
    //     return null;
    // }

    return (
        <section className="kurzy">
            <Intro />
            <About />
        </section>
    )
}