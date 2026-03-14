"use client"
import LinkButton from "@modules/common/components/Buttons/LinkButton";
import CTA from "@modules/home/Kurzy/CTA";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

const faq = [
    {
        title: "Vyrábíte keramiku na zakázku?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
    {
        title: "Jak probíhá zakázková výroba?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
    {
        title: "Jak dlouho trvá výroba zakázkového produktu?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
    {
        title: "Jak dlouho trvá naskladnění vyprodaných produktů?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
    {
        title: "Jsou produkty ručně vyráběné?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
    {
        title: "Proč je keramika křehká a vyžaduje speciální balení?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
    {
        title: "Co dělat, pokud zásilka dorazí poškozená?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
    {
        title: "Je možné produkt vrátit nebo vyměnit?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
    {
        title: "Pořádáte kurzy nebo workshopy pro školy?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
    {
        title: "Jak vás mohu kontaktovat?",
        desc: "Ano. Nabízíme výrobu keramických výrobků na zakázku pro jednotlivce, interiéry i speciální projekty. Každá zakázka se řeší individuálně."
    },
]

type ActiveState = string | null

export default function FAQBody () {
    const [ active, setActive ] = useState<ActiveState>("Vyrábíte keramiku na zakázku?")

    return (
        <section className="FAQBody">
            <div className="header">
                <h2>
                    VŠE NEJDŮLEŽITĚJŠÍ, <br />
                    CO POTŘEBUJETE VĚDĚT.
                </h2>
                <p>
                    Jsem moc ráda a vážím si vaši návštěvy v mém obchůdku. <br />Jestli je něco na, co se chcete zeptat, <br />dole najdete nejčastější otázky a infomrace.<br /> 
                    A pokud ne, kontaktujte mne přes formu nebo mi zavolejte.
                </p>
            </div>

            <div className="faq__container">
                <div className="faq">
                    {faq.map((question) => {
                        const {title, desc} = question
                        return (
                            <Question 
                                key={title}
                                title={title} 
                                desc={desc} 
                                active={active} 
                                setActive={setActive}
                                id={title}
                            />
                        )
                    })}
                </div>
                <div className="faq__kontakt">
                    <div className="connect">
                        <p className="p">
                            VAŠE OTÁZKA <br />CHYBÍ?
                        </p>
                        <CTA text="Spojte se" kind="secondary"/>
                    </div>
                    <div className="phone">
                        <p className="p">
                            NEBO <br />TELEFONICKY
                        </p>
                        <LinkButton text="+420 775 211 578" href="+420 775 211 578"/>
                    </div>
                </div>
            </div>
        </section>
    )
}

type QuestionProps = {
  desc: string
  title: string
  id: string
  active: ActiveState
  setActive: (next: ActiveState) => void
}
const Question = ({desc, title, id, active, setActive} : QuestionProps) => {
    return (
        <div className="question" onClick={() => setActive(active === id ? null : id)}>
            <div className="title">
                <p>
                    {title}
                </p>
                <Image src="/assets/icons/cross.png" alt="plus__icon" height={20} width={20}/>
            </div>
            <AnimatePresence initial={false}>
                {active === id &&
                    <motion.div 
                        className="faq__content" 
                        key={id}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                    >
                        <div className="divider"/>
                        <p>{desc}</p>
                        
                    </motion.div>
                }
            </AnimatePresence>
            <div className="divider"/>
        </div>
    )
}
