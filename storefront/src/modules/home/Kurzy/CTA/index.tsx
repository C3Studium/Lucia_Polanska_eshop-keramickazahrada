"use client";
import LinkButton from "@modules/common/components/Buttons/LinkButton";
import MainButton from "@modules/common/components/Buttons/MainButton";
import { AnimatePresence, motion, Easing } from "framer-motion";
import Image from "next/image"
import { usePathname } from "next/navigation";
import { act, useState } from "react";
import { text } from "stream/consumers";

type Tags = [
    { text: string, active: boolean }
]

type CTA = {
    text: string,
    kind: "primary" | "secondary",
    img?: string, 
    alt?: string,
}

const tags = [
    { 
        text: "#Dotaz",
        active: false 
    },
    { text: "#Objednavka", active: false },
    { text: "#Kurzy", active: false },
    { text: "#E-shop", active: false }
]

const ctaAnim = {
    initial: {
        y: "100%"
    },
    enter: {
        y: "0%",
        transition: {
            duration: 0.8,
            ease: [ 0.75, 0, 0.21, 1] as Easing
        }
    },
    exit: {
        y: "100%",
        transition: {
            duration: 0.8,
            ease: [ 0.75, 0, 0.21, 1] as Easing
        }
    }
}
const divAnim = {
    initial: {
        y: "100%"
    },
    enter: {
        y: "0%",
        transition: {
            duration: 0.8,
            delay: 0.3,
            ease: [ 0.75, 0, 0.21, 1] as Easing
        }
    },
    exit: {
        y: "100%",
        transition: {
            duration: 0.8,
            delay: 0.3,
            ease: [ 0.75, 0, 0.21, 1] as Easing
        }
    }
}

export default function CTA({ text, kind, img, alt }: CTA) {
    const pathname = usePathname();
    const [active, setActive] = useState<boolean>(false);
    const tagValue = useState<Tags>([
        { text: "#Dotaz", active: false }
    ]);

    const isRed = pathname === "/kurzy" || pathname === "/vyroba";
    const handleClick = () => {
        setActive(!active);
    }
    return (
        <div className="CTA__block">
            <div className="button__container">
                <MainButton text={text} kind="CTA" type="button" onClickAction={handleClick} className="CTA__button"/>
            </div>
            <AnimatePresence>
                { 
                    active && (
                        <motion.div className="form__parent" key={"cta"} variants={ctaAnim} initial="initial" exit="exit" animate="enter">
                            <motion.div className="clickable" onClick={handleClick} variants={divAnim} initial="initial" exit="exit" animate="enter" key="div"/>
                            <div className="form" style={{backgroundColor: isRed ? "var(--bgBlack)" : "var(--bgPrimary)"}}>
                                <div className="form__container" >
                                    <div className="form__wrapper">
                                        <div className="header">
                                            <div className="text">
                                                <h2>
                                                    Máte nějaký dotaz? 
                                                </h2>
                                            </div>
                                            <div className="Faq">
                                                <p>
                                                    Zkuste nejdříve FAQ
                                                </p>
                                                <MainButton href="/dotazy" kind="Link" text="FAQ" type="button"/>
                                            </div>
                                        </div>
                                        <div className="form__content">
                                            <div className="pillar">
                                                <Image src="/assets/icons/pillar_white.svg" alt="pillar image" fill />
                                            </div>
                                            <form className="form">
                                                <div className="header">
                                                    <p>Vyplnte formu dole</p>
                                                </div>
                                                <div className="divider"/>
                                                <div className="form__inputs">
                                                    <FormInput label="Jméno" placeholder="Zadejte své jméno"/>
                                                    <div className="divider"/>
                                                    <FormInput label="E-mail" placeholder="Zadejte svůj e-mail"/>
                                                    <div className="divider"/>
                                                    <FormInputPhone label="Telefon" placeholder="Zadejte svůj telefon"/>
                                                    <div className="divider"/>
                                                    <FormTextArea label="Zpráva" placeholder="Napište nám zprávu"/>
                                                </div>
                                                <div className="buttons">
                                                    <div className="tag__buttons">
                                                        {tags.map((tag, index) => (
                                                            <MainButton text={tag.text} kind="Submit" type="submit"/>
                                                        ))}
                                                    </div>
                                                    <div className="send__button">
                                                        <MainButton text="Odeslat" kind="Submit" type="submit"/>
                                                    </div>
                                                </div>
                                            </form>
                                        </div>
                                        <div className="gdpr">
                                            <p>
                                                S kliknuti na tlacitko poslat souhlasite ke spracovani osobnich udaju.
                                            </p>
                                            <LinkButton href="/gdpr" text="Vice"/>
                                        </div>
                                    </div>
                                    <div className="image">
                                        <div className="image__wrapper">
                                            <Image src="/assets/img/kittenphoto.png" alt="CTA image" fill style={{objectFit: "cover"}}/>
                                        </div>
                                    </div>
                                </div>
                                <div className="information">
                                    <div className="map">
                                        <p className="p">KDE MĚ NAJDETE</p>
                                        <div className="text">
                                            <p>
                                                Putim 229, Písek 397 01
                                            </p>
                                            <MainButton text="Mapa Google" kind="Link" type="button" href="" className="map_button"/>
                                        </div>
                                    </div>
                                    <div className="information__kontakt">
                                        <p className="p">
                                            Kontaktujte mě telefonicky
                                        </p>
                                        <div className="phone">
                                            <p>
                                                Po-Pa | 9 - 17
                                            </p>
                                            <LinkButton text="+420 775 211 578" href="+420 775 211 578"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )
                }
            </AnimatePresence>
        </div>
    )
}

const FormInput = ({ label, placeholder }: { label: string, placeholder: string }) => {
    return (
        <div className="form__input">
            <label htmlFor={label}>{label}</label>
            <input type="text" id={label} placeholder={placeholder}/>
        </div>
    )
}

const FormInputPhone = ({ label, placeholder }: { label: string, placeholder: string }) => {
    return (
        <div className="form__input">
            <label htmlFor={label}>{label}</label>

            <div className="input">
                <List items={["+420", "+421", "+43"]}/>
                <input type="tel" id={label} placeholder={placeholder}/>
            </div>
        </div>
    )
}
const FormTextArea = ({ label, placeholder }: { label: string, placeholder: string }) => {
    return (
        <div className="form__input__area">
            <div className="label">
                <label htmlFor={label}>{label}</label>
            </div>
            <textarea id={label} placeholder={placeholder}/>
        </div>
    )
}

const List = ({ items }: { items: string[] }) => {
    return (
        <ul className="list">
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    )
}