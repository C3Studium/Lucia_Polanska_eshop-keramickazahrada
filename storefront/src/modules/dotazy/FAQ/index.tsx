"use client"
import LinkButton from "@modules/common/components/Buttons/LinkButton";
import MainButton from "@modules/common/components/Buttons/MainButton";
import CTA from "@modules/home/Kurzy/CTA";
import { AnimatePresence, Easing, motion } from "framer-motion";
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

type ActiveState = {
  index: number | null,
  state: boolean
}

export default function FAQBody () {
    const [ active, setActive ] = useState<ActiveState>({index: null, state: false})

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
                <div className="faq" key={"faq__div"}>
                    {faq.map((question, index) => {
                        const {title, desc} = question
                        return (
                            <Question index={index} title={title} desc={desc} active={active} setActive={setActive}/>
                        )
                    })}
                </div>
                <div className="faq__kontakt">
                    <div className="connect">
                        <p>
                            VAŠE OTÁZKA <br />CHYBÍ?
                        </p>
                        <CTA text="Spojte se" kind="secondary"/>
                    </div>
                    <div className="phone">
                        <p>
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
  index: number
  active: ActiveState
  setActive: (next: ActiveState) => void
}
const Question = ({desc, title, index, active, setActive} : QuestionProps) => {

    const height = {
        initial: {
            height: "0%"
        },
        active: {
            height: "100%",
            transition: {
                duration: 0.5,
                ease: [ 0.76, 0, 0.25, 1] as Easing
            }
        },
        closed: {
            height: "0%",
            transition: {
                duration: 0.5,
                ease: [ 0.76, 0, 0.25, 1] as Easing
            }
        }
    }
    return (
        <div className="question" onClick={() => setActive({ index, state: !active.state })}>
            <div className="title">
                <p>
                    {title}
                </p>
                <Image src="/assets/icons/plus.svg" alt="plus__icon" height={40} width={40}/>
            </div>
            <AnimatePresence>
                {active.index === index &&
                <div className="content__wrapper">
                    <motion.div 
                        className="content" 
                        key={`key_index${index}`}
                        variants={height}
                        initial="initial"
                        animate={ active.index === index ? "active" : "closed"}
                    >
                        <div className="divider"/>
                        <p>{desc}</p>
                    </motion.div>
                </div>}
            </AnimatePresence>
        </div>
    )
}