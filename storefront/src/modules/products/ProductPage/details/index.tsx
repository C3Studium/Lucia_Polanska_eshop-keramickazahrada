"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HttpTypes } from "@medusajs/types";
import InfoDesc from "./components/info";
import Desc from "./components/desc";
import Shipment from "./components/delivery";

const disclosureVariants = {
    closed: { height: 0, opacity: 0, y: -6 },
    open: { height: "auto", opacity: 1, y: 0 },
};

const disclosureIconVariants = {
    closed: { rotate: 0, scale: 1 },
    open: { rotate: 45, scale: 1.04 },
};

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

    // "Výroba" used to render product.description verbatim — identical to "Popisek" — and
    // sections rendered a literal "N/A" when their data was unset (spec §3.3). A panel is now
    // only offered when it has something to say.
    const details = [
        product.description && {
            title: "Popisek",
            component: <InfoDesc description={product.description} />
        },
        descriptions.length > 0 && {
            title: "Rozměry a materiál",
            component: <Desc details={descriptions} />
        },
        {
            title: "Doprava a vrácení",
            component: <Shipment shipping={shipping} />
        },
    ].filter(Boolean) as { title: string; component: React.ReactNode }[];

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
        <section className="detailsProduct" id="product-details">
            <div className="details__title">
                <h2>Detaily</h2>
            </div>
            <div className="details__content">
                <ul className="details__content__list">
                    {details.map((detail, idx) => (
                        <li className="details__content__list__item" key={idx}>
                            <motion.button
                                type="button"
                                className="details__content__list__item__main"
                                onClick={() => toggleOpen(idx)}
                                aria-expanded={open.includes(idx)}
                                aria-controls={`product-detail-panel-${idx}`}
                                initial="closed"
                                animate={open.includes(idx) ? "open" : "closed"}
                            >
                                <h3>{detail.title}</h3>
                                <motion.span
                                    className="details__content__list__item__main__button"
                                    variants={disclosureIconVariants}
                                    transition={transition}
                                    aria-hidden="true"
                                >
                                    <i />
                                    <i />
                                </motion.span>
                            </motion.button>
                            <AnimatePresence initial={false}>
                                {open.includes(idx) && (
                                    <motion.div
                                        id={`product-detail-panel-${idx}`}
                                        className="details__content__list__item__inner"
                                        variants={disclosureVariants}
                                        initial="closed"
                                        animate="open"
                                        exit="closed"
                                        transition={transition2}
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


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: .52, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const transition2 = {
                                            duration: 0.62,
                                            ease: [0.76, 0, 0.24, 1] as [number, number, number, number],
                                        }
