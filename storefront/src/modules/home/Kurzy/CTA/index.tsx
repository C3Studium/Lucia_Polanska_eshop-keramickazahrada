"use client";
import LinkButton from "@modules/common/components/Buttons/LinkButton";
import Button from "@modules/common/components/Buttons/button";
import { AnimatePresence, motion, Easing } from "framer-motion";
import Image from "next/image"
import { usePathname } from "next/navigation";
import { useState } from "react";

type Tag = { text: string, active: boolean }
type Tags = Tag[]

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
    const [tagValue, setTagValue] = useState<Tags>([
        { text: "#Dotaz", active: false }
    ]);

    const isRed = pathname === "/kurzy" || pathname === "/vyroba";
    const handleClick = () => {
        setActive(!active);
    }

    const Submit = () => {

    }

    const tagChoice = ({ input, state }: { input: string; state: boolean }) => {
        setTagValue((prev) => {
            const exists = prev.some((tag) => tag.text === input)
            if (!exists) {
                return [...prev, { text: input, active: state }]
            }
            return prev.map((tag) =>
                tag.text === input ? { ...tag, active: state } : tag
            )
        })
    }
    return (
        <div className="CTA__block">
            <Button img="/assets/links/home_img.png" alt="bg__image" Kind="Button" title={text} onClickAction={handleClick}/>
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
                                                <Button href="/dotazy" Kind="Link" title="FAQ" />
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
                                                            <Button title={tag.text} Kind="Button" key={index} onTagAction={tagChoice}/>
                                                        ))}
                                                    </div>
                                                    <div className="send__button">
                                                        <Button title="Odeslat" Kind="Button" onClickAction={Submit}/>
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
                                            <Button title="Mapa Google" Kind="Link" href="" className="map_button"/>
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
