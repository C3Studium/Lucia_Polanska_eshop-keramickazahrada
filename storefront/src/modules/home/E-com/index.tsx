"use client";
import { useState, useEffect } from "react";
import { client } from "../../../sanity/lib/client";
import IntroSection from "./Intro";
import Collections from "./Collections";
import CollectionTemplate from "@modules/collections/templates";
import Courses from "./Courses";

export default function ECom() {
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const mainSettings = await client.fetch('*[_type == "mainPageSettings"][0]');
            setSettings(mainSettings);
        };
        fetchSettings();
    }, []);

    const ecomEnabled = settings?.ecomSection?.enabled !== false;
    const introEnabled = settings?.ecomSection?.intro !== false;
    const entryEnabled = settings?.ecomSection?.entry !== false;
    const descEnabled = settings?.ecomSection?.desc?.enabled !== false;
    const ctaEnabled = settings?.ecomSection?.cta !== false;

    if (!ecomEnabled) {
        return null;
    }

    return (
        <section>
            <IntroSection />
            <Collections /> 
            <Courses /> 
        </section>
    )
}