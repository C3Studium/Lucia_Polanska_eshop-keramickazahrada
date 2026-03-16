"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { HttpTypes } from "@medusajs/types";
import InfoDesc from "./components/info";
import Desc from "./components/desc";
import Shipment from "./components/delivery";

export default function Details({ product }: { product: HttpTypes.StoreProduct }) {
    const [open, setOpen] = useState<number[]>([]);

    const toggleOpen = (idx: number) => {
        setOpen(prev =>
            prev.includes(idx)
                ? prev.filter(i => i !== idx)
                : [...prev, idx]
        );
    };

    const descriptions = [
        {
            title: "Výška",
            content: product.height ? `${product.height} cm` : "N/A"
        },
        {
            title: "Šířka",
            content: product.width ? `${product.width} cm` : "N/A"
        },
        {
            title: "Hloubka",
            content: product.length ? `${product.length} cm` : "N/A"
        },
        {
            title: "Materiál",
            content: product.material ? `Materiál: ${product.material}` : "N/A"
        },
        {
            title: "Hmotnost",
            content: product.weight ? `${product.weight} g` : "N/A"
        }
    ];

    const shipping = [
        {
            title: "Rychlé a bezpečné doručení",
            content: "Vaši ručně vyrobenou keramiku pečlivě zabalíme a doručíme přes Českou poštu nebo Zásilkovnu - buď k vám domů, nebo na výdejní místo dle vašeho výběru.",
        },
        {
            title: "Výměna bez starostí",
            content: "Nesedí barva, tvar nebo styl? Napište nám – uděláme, co bude v našich silách, abychom našli vhodnou výměnu.",
        },
        {
            title: "Cena Doručení",
            content: "Cena doručení se liší podle velikosti a váhy objednávky. Pro více informací nás kontaktujte.",
        }
    ];

    const details = [
        {
            title: "Popisek",
            component: <InfoDesc description={product.description || "N/A"} />
        },
        {
            title: "O Výrobku",
            component: <Desc details={descriptions} />
        },
        {
            title: "Doprava",
            component: <Shipment shipping={shipping} />
        },
        {
            title: "Výroba",
            component: <InfoDesc description={product.description || "N/A"} />
        }
    ];

    useEffect(() => {
        const handleOpenDescription = () => {
            setOpen((prev) => (prev.includes(0) ? prev : [0, ...prev]));
        };

        window.addEventListener("open-product-details-desc", handleOpenDescription);
        return () => {
            window.removeEventListener("open-product-details-desc", handleOpenDescription);
        };
    }, []);

    return (
        <section className="details" id="product-details">
            <div className="details__title">
                <h2>Detaily</h2>
            </div>
            <div className="details__content">
                <ul className="details__content__list">
                    {details.map((detail, idx) => (
                        <li className="details__content__list__item" key={idx}>
                            <div
                                className="details__content__list__item__main"
                                onClick={() => toggleOpen(idx)}
                                style={{ cursor: "pointer" }}
                            >
                                <h3>{detail.title}</h3>
                                <div className="details__content__list__item__main__button">
                                    <Image
                                        src="/assets/icons/cross.png"
                                        alt="Toggle Icon"
                                        width={24}
                                        height={24}
                                        style={{
                                            transform: open.includes(idx) ? "rotate(45deg)" : "none",
                                            transition: "transform 0.3s"
                                        }}
                                    />
                                </div>
                            </div>
                            <AnimatePresence initial={false}>
                                {open.includes(idx) && (
                                    <motion.div
                                        className="details__content__list__item__inner"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "fit-content", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                            duration: 0.5,
                                            ease: [0.76, 0, 0.24, 1],
                                        }}
                                        style={{ overflow: "hidden" }}
                                    >
                                        {detail.component}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
