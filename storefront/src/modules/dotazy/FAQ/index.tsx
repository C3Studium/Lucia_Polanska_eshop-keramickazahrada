"use client"

import ContactTrigger from "@modules/layout/ContactDialog/trigger"
import { AnimatePresence, motion, type Easing, type Variants } from "framer-motion"
import Image from "next/image"
import { useMemo, useState } from "react"

import { easeReveal } from "@lib/motion-tokens"

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
        desc: "Ano, ráda. Dělám zakázky pro jednotlivce, do interiérů i na menší architektonické projekty. Vždycky si to nejdřív spolu ujasníme — rozměr, povrch, termín i cenu.",
    },
    {
        id: "prubeh-zakazky",
        category: "zakazka" as Category,
        title: "Jak probíhá zakázková výroba?",
        desc: "Nejdřív si popovídáme, pak vám pošlu návrh, cenu a přibližný termín. Když odsouhlasíte, pustím se do práce — modelování, sušení, první výpal, glazování a závěrečný výpal. Průběžně vám dávám vědět, jak to jde.",
    },
    {
        id: "delka-vyroby",
        category: "zakazka" as Category,
        title: "Jak dlouho trvá výroba na zakázku?",
        desc: "Většinou šest až deset týdnů — podle toho, jak je to velké a kolik toho mám v peci. Hlína musí pomalu vyschnout a projít dvěma výpaly, spěchat se nedá. Přesný termín si vždycky domluvíme předem.",
    },
    {
        id: "dostupnost",
        category: "produkty" as Category,
        title: "Kdy bude vyprodaný produkt znovu dostupný?",
        desc: "Menší série doplňuju průběžně, ale každý kus vypadá trochu jinak. U výrobku si můžete nechat poslat upozornění, až bude znovu skladem — nebo mi napište a řeknu vám, kdy to plánuju.",
    },
    {
        id: "rucni-vyroba",
        category: "produkty" as Category,
        title: "Jsou všechny produkty ručně vyráběné?",
        desc: "Ano, všechno. Každý kus dělám ručně v ateliéru v Písku. Drobné rozdíly v kresbě, odstínu nebo rozměru nejsou vada — podle nich poznáte ruční práci.",
    },
    {
        id: "baleni",
        category: "doprava" as Category,
        title: "Jak keramiku balíte pro bezpečnou přepravu?",
        desc: "Každý kus obalíme několika vrstvami a uložíme do pevné krabice tak, aby se v ní nemohl hýbat. Kde to jde, používáme výplně, které se dají použít znovu nebo vytřídit.",
    },
    {
        id: "poskozena-zasilka",
        category: "doprava" as Category,
        title: "Jak postupovat, když zásilka dorazí poškozená?",
        desc: "Vyfoťte prosím balík i poškozený kus hned po rozbalení a ozvěte se nám do 48 hodin. Přiložte číslo objednávky a domluvíme se na výměně, opravě nebo vrácení peněz.",
    },
    {
        id: "vraceni",
        category: "doprava" as Category,
        title: "Mohu produkt vrátit nebo vyměnit?",
        desc: "Nepoužitý výrobek z běžné nabídky můžete vrátit do 14 dnů od převzetí. Zakázkové kusy dělané přímo pro vás vrátit bohužel nejde — pokud tedy nejsou poškozené nebo vadné.",
    },
    {
        id: "kurzy-pro-skoly",
        category: "kurzy" as Category,
        title: "Pořádáte kurzy pro školy nebo soukromé skupiny?",
        desc: "Ano. Program i délku přizpůsobím věku a zkušenostem skupiny. Napište mi, kolik vás bude a kdy by se vám to hodilo, a připravím konkrétní nabídku.",
    },
    {
        id: "kontakt",
        category: "vse" as Category,
        title: "Jak vás mohu kontaktovat?",
        desc: "Nejrychleji přes kontaktní formulář, nebo mi zavolejte na +420 775 211 578. Odpovídám zpravidla do dvou pracovních dnů; když stojím u pece, může to trvat o kousek déle.",
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
                viewport={sectionViewport}
                variants={sectionVariants}
            >
                <motion.div variants={faqRevealItem}>
                    <span className="faqEyebrow">Odpovědi · 02</span>
                    <h2 id="faq-section-title">
                        Na co se ptáte<br />nejčastěji.
                    </h2>
                </motion.div>
                <motion.p variants={faqRevealItem}>
                    Sepsala jsem, na co se lidé ptají nejčastěji — objednávky, výroba,
                    doprava i kurzy. Kdyby tu něco chybělo, napište mi.
                </motion.p>
            </motion.div>

            <motion.div
                className="faqToolbar"
                initial={searchInitial}
                whileInView={searchInView}
                viewport={searchViewport}
                transition={searchTransition}
            >
                <label className="faqSearch">
                    <span>Hledat v otázkách</span>
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.currentTarget.value)}
                        placeholder="Na co se chcete zeptat?"
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
                                    transition={pillTransition}
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
                    initial={listInitial}
                    whileInView={listInView}
                    viewport={listViewport}
                    transition={listTransition}
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
                        <motion.p className="faqEmpty" initial={emptyInitial} animate={emptyAnimate}>
                            Na tohle tu odpověď nemáme. Napište mi a poradím vám osobně.
                        </motion.p>
                    )}
                </motion.div>

                <motion.aside
                    className="faqContact"
                    initial={asideInitial}
                    whileInView={asideInView}
                    viewport={asideViewport}
                    transition={asideTransition}
                >
                    <div className="faqContactImage">
                        <Image src="/assets/img/faq/FAQ4.png" alt="Ručně balená keramika z ateliéru" fill sizes="32vw" />
                        <span />
                    </div>
                    <div className="faqContactCopy">
                        <span className="faqEyebrow">Ještě něco? · 03</span>
                        <h3>Nenašli jste odpověď?</h3>
                        <p>Napište mi přímo do ateliéru. Ozvu se zpravidla do dvou pracovních dnů.</p>
                        <div className="faqContactActions">
                            <ContactTrigger text="Napsat zprávu" />
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

    /* The only per-question value is the stagger delay, and it depends solely on the row's
       position — not on which question happens to be open. */
    const questionTransition = useMemo(
        () => ({
            duration: 0.4,
            delay: Math.min(index * 0.032, 0.16),
            ease: easeReveal,
            layout: questionLayoutTransition,
        }),
        [index]
    )

    return (
        <motion.article
            layout
            className={`question ${isActive ? "active" : ""}`}
            initial={questionInitial}
            animate={questionAnimate}
            exit={questionExit}
            transition={questionTransition}
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
                        initial={answerInitial}
                        animate={answerAnimate}
                        exit={answerInitial}
                        transition={answerTransition}
                    >
                        <motion.p
                            initial={answerCopyInitial}
                            animate={answerCopyAnimate}
                            transition={answerCopyTransition}
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

/* Hoisted out of render: the FAQ list re-renders on every keystroke in the search field and on
   every category toggle, so each inline literal was re-allocated per question, per keystroke. */
const sectionViewport = { once: true, amount: 0.34 } as const
const sectionVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
}
const searchInitial = { opacity: 0, y: 18, clipPath: "inset(0 10% 0 10% round 999px)" }
const searchInView = { opacity: 1, y: 0, clipPath: "inset(0 0% 0 0% round 999px)" }
const searchViewport = { once: true, amount: 0.55 } as const
const searchTransition = { duration: 0.72, ease: easeReveal }
const pillTransition = { type: "spring", stiffness: 420, damping: 36, mass: 0.7 } as const
const listInitial = { opacity: 0, y: 24 }
const listInView = { opacity: 1, y: 0 }
const listViewport = { once: true, amount: 0.12 } as const
const listTransition = { duration: 0.7, ease: easeReveal }
const emptyInitial = { opacity: 0 }
const emptyAnimate = { opacity: 1 }
const asideInitial = { opacity: 0, y: 30, clipPath: "inset(0 0 18% 0 round 18px)" }
const asideInView = { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0 round 18px)" }
const asideViewport = { once: true, amount: 0.35 } as const
const asideTransition = { duration: 0.7, ease: easeReveal }

const questionInitial = { opacity: 0, y: 14 }
const questionAnimate = { opacity: 1, y: 0 }
const questionExit = { opacity: 0, y: -10 }
const answerInitial = { height: 0, opacity: 0 }
const answerAnimate = { height: "auto", opacity: 1 }
const answerTransition = { duration: 0.78, ease: easeReveal }
const answerCopyInitial = { opacity: 0, y: 10 }
const answerCopyAnimate = { opacity: 1, y: 0 }
const answerCopyTransition = { delay: 0.22, duration: 0.44, ease: easeReveal }
const questionLayoutTransition = { duration: 0.8, ease: easeReveal }
