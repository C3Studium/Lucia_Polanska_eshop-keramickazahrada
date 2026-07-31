"use client"

import CTA from "@modules/home/Kurzy/CTA"
import { AnimatePresence, motion, type Easing, type Variants } from "framer-motion"
import Image from "next/image"
import { useMemo, useState } from "react"

type Category = "vse" | "zakazka" | "produkty" | "doprava" | "kurzy"

const categories: { id: Category; label: string }[] = [
    { id: "vse", label: "Vše" },
    { id: "zakazka", label: "Zakázková výroba" },
    { id: "produkty", label: "Produkty" },
    { id: "doprava", label: "Doprava a vrácení" },
    { id: "kurzy", label: "Kurzy" },
]

const faq = [
    {
        id: "vyroba-na-zakazku",
        category: "zakazka" as Category,
        title: "Vyrábíte keramiku na zakázku?",
        desc: "Ano. Zakázkovou tvorbu připravujeme pro jednotlivce, interiéry i menší architektonické projekty. Každou poptávku nejdříve společně upřesníme — od rozměru a povrchu až po termín a rozpočet.",
    },
    {
        id: "prubeh-zakazky",
        category: "zakazka" as Category,
        title: "Jak probíhá zakázková výroba?",
        desc: "Po úvodní konzultaci připravíme návrh, cenový rámec a orientační termín. Po jejich odsouhlasení začíná ruční výroba, sušení, první výpal, glazování a závěrečný výpal. O důležitých krocích vás průběžně informujeme.",
    },
    {
        id: "delka-vyroby",
        category: "zakazka" as Category,
        title: "Jak dlouho trvá výroba na zakázku?",
        desc: "Obvykle šest až deset týdnů podle rozsahu, použité techniky a vytíženosti pece. Keramika potřebuje přirozeně vyschnout a projít několika výpaly, proto přesný termín potvrzujeme vždy individuálně.",
    },
    {
        id: "dostupnost",
        category: "produkty" as Category,
        title: "Kdy bude vyprodaný produkt znovu dostupný?",
        desc: "Menší série doplňujeme průběžně, každý kus se však může lehce lišit. U vybraného produktu doporučujeme zapnout upozornění na dostupnost nebo nám napsat — rádi sdělíme nejbližší plánovaný termín.",
    },
    {
        id: "rucni-vyroba",
        category: "produkty" as Category,
        title: "Jsou všechny produkty ručně vyráběné?",
        desc: "Ano. Každý objekt vzniká ručně v malých sériích v našem ateliéru. Drobné rozdíly v kresbě, odstínu nebo rozměru nejsou vadou, ale přirozenou součástí autorské keramiky.",
    },
    {
        id: "baleni",
        category: "doprava" as Category,
        title: "Jak keramiku balíte pro bezpečnou přepravu?",
        desc: "Každý kus chráníme několika vrstvami a ukládáme jej do pevné krabice tak, aby se během přepravy nemohl pohybovat. Kde je to možné, používáme znovu využitelné nebo recyklovatelné výplně.",
    },
    {
        id: "poskozena-zasilka",
        category: "doprava" as Category,
        title: "Jak postupovat, když zásilka dorazí poškozená?",
        desc: "Balík i poškozený výrobek prosím vyfoťte ihned po rozbalení a ozvěte se nám do 48 hodin. Připojte číslo objednávky; společně domluvíme výměnu, opravu nebo vrácení peněz.",
    },
    {
        id: "vraceni",
        category: "doprava" as Category,
        title: "Mohu produkt vrátit nebo vyměnit?",
        desc: "Nepoužitý produkt ze standardní nabídky můžete vrátit do 14 dnů od převzetí. Zakázkové a personalizované výrobky vrátit nelze, pokud nejsou poškozené nebo vadné.",
    },
    {
        id: "kurzy-pro-skoly",
        category: "kurzy" as Category,
        title: "Pořádáte kurzy pro školy nebo soukromé skupiny?",
        desc: "Ano. Program, délku i náročnost workshopu přizpůsobíme věku a zkušenostem skupiny. Napište nám přibližný počet účastníků a preferovaný termín a připravíme konkrétní nabídku.",
    },
    {
        id: "kontakt",
        category: "vse" as Category,
        title: "Jak vás mohu kontaktovat?",
        desc: "Nejrychleji přes kontaktní formulář nebo telefonicky na čísle +420 775 211 578. Odpovídáme zpravidla do dvou pracovních dnů; během práce u pece to může trvat o něco déle.",
    },
]

type ActiveState = string | null

export default function FAQBody() {
    const [active, setActive] = useState<ActiveState>(faq[0].id)
    const [category, setCategory] = useState<Category>("vse")
    const [query, setQuery] = useState("")

    const visibleQuestions = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase("cs")

        return faq.filter((question) => {
            const matchesCategory = category === "vse" || question.category === category || question.category === "vse"
            const matchesQuery = !normalizedQuery || `${question.title} ${question.desc}`.toLocaleLowerCase("cs").includes(normalizedQuery)
            return matchesCategory && matchesQuery
        })
    }, [category, query])

    return (
        <section
            className="FAQBody"
            id="faq-answers"
            data-scroll-section
            data-scroll-label="Odpovědi"
            aria-labelledby="faq-section-title"
        >
            <motion.div
                className="faqIntro"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.34 }}
                variants={{
                    hidden: {},
                    show: { transition: { staggerChildren: 0.09 } },
                }}
            >
                <motion.div variants={faqRevealItem}>
                    <span className="faqEyebrow">Pomoc při výběru · 02</span>
                    <h2 id="faq-section-title">
                        Vše důležité,<br />co potřebujete vědět.
                    </h2>
                </motion.div>
                <motion.p variants={faqRevealItem}>
                    Keramika vzniká pomalu a stejně pečlivě přistupujeme i k vašim otázkám.
                    Zde najdete odpovědi k objednávkám, výrobě, dopravě i kurzům.
                </motion.p>
            </motion.div>

            <motion.div
                className="faqToolbar"
                initial={{ opacity: 0, y: 18, clipPath: "inset(0 10% 0 10% round 999px)" }}
                whileInView={{ opacity: 1, y: 0, clipPath: "inset(0 0% 0 0% round 999px)" }}
                viewport={{ once: true, amount: 0.55 }}
                transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}
            >
                <label className="faqSearch">
                    <span>Hledat v otázkách</span>
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.currentTarget.value)}
                        placeholder="Co potřebujete vědět?"
                    />
                    <span className="faqSearchIcon" aria-hidden="true" />
                </label>
                <div className="faqCategories" aria-label="Kategorie otázek">
                    {categories.map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            className={category === item.id ? "active" : ""}
                            aria-pressed={category === item.id}
                            onClick={() => setCategory(item.id)}
                        >
                            {category === item.id && (
                                <motion.span
                                    className="faqCategoryIndicator"
                                    layoutId="faq-category-indicator"
                                    transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.7 }}
                                />
                            )}
                            <span className="faqCategoryLabel">{item.label}</span>
                        </button>
                    ))}
                </div>
            </motion.div>

            <div className="faqLayout">
                <motion.div
                    className="faqList"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.12 }}
                    transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
                >
                    <AnimatePresence mode="popLayout" initial={false}>
                        {visibleQuestions.map((question, index) => (
                            <Question
                                key={question.id}
                                number={String(index + 1).padStart(2, "0")}
                                title={question.title}
                                desc={question.desc}
                                active={active}
                                setActive={setActive}
                                id={question.id}
                                index={index}
                            />
                        ))}
                    </AnimatePresence>
                    {!visibleQuestions.length && (
                        <motion.p className="faqEmpty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            Tuto otázku jsme nenašli. Napište nám a rádi vám poradíme osobně.
                        </motion.p>
                    )}
                </motion.div>

                <motion.aside
                    className="faqContact"
                    initial={{ opacity: 0, y: 30, clipPath: "inset(0 0 18% 0 round 18px)" }}
                    whileInView={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0 round 18px)" }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
                >
                    <div className="faqContactImage">
                        <Image src="/assets/img/faq/FAQ4.png" alt="Ručně balená keramika z ateliéru" fill sizes="32vw" />
                        <span />
                    </div>
                    <div className="faqContactCopy">
                        <span className="faqEyebrow">Osobní pomoc · 03</span>
                        <h3>Nenašli jste odpověď?</h3>
                        <p>Napište přímo do ateliéru. Ozveme se zpravidla do dvou pracovních dnů.</p>
                        <div className="faqContactActions">
                            <CTA text="Napsat zprávu" kind="secondary" />
                            <a href="tel:+420775211578">+420 775 211 578</a>
                        </div>
                    </div>
                </motion.aside>
            </div>
        </section>
    )
}

type QuestionProps = {
    desc: string
    title: string
    id: string
    number: string
    index: number
    active: ActiveState
    setActive: (next: ActiveState) => void
}

function Question({ desc, title, id, number, index, active, setActive }: QuestionProps) {
    const isActive = active === id

    return (
        <motion.article
            layout
            className={`question ${isActive ? "active" : ""}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.032, 0.16), ease: [0.76, 0, 0.24, 1], layout: { duration: 0.5, ease: [0.76, 0, 0.24, 1] } }}
        >
            <button
                type="button"
                className="questionTitle"
                aria-expanded={isActive}
                aria-controls={`answer-${id}`}
                onClick={() => setActive(isActive ? null : id)}
            >
                <span className="questionNumber">{number}</span>
                <span className="questionLabel">{title}</span>
                <span className="questionToggle" aria-hidden="true"><i /><i /></span>
            </button>
            <AnimatePresence initial={false}>
                {isActive && (
                    <motion.div
                        id={`answer-${id}`}
                        className="faqAnswer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.48, ease: [0.76, 0, 0.24, 1] }}
                    >
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.38, ease: [0.76, 0, 0.24, 1] }}
                        >
                            {desc}
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    )
}

const faqEase = [0.76, 0, 0.24, 1] as Easing

const faqRevealItem: Variants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: faqEase } },
}
