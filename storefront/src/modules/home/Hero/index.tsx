"use client";
import { useState, useEffect } from "react";
import IntroHero from "./IntroHero";
import { client } from "../../../sanity/lib/client";

export default function HeroSection() {
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const mainSettings = await client.fetch('*[_type == "mainPageSettings"][0]');
            setSettings(mainSettings);
        };
        fetchSettings();
    }, []);

    const heroEnabled = settings?.heroSection?.enabled !== false;
    const introHeroEnabled = settings?.heroSection?.introHero !== false;
    const aboutHeroEnabled = settings?.heroSection?.aboutHero !== false;

    if (!heroEnabled) {
        return null;
    }

    return (
        <section>
            {introHeroEnabled && <IntroHero />}
        </section>
    )
}