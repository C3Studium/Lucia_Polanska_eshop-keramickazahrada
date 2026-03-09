"use client";
import MainButton from "@modules/common/components/Buttons/MainButton";
import Image from "next/image"
import { useState } from "react";
import { text } from "stream/consumers";

type Tags = [
    { text: string, active: boolean }
]

const tags = [
    { 
        text: "#Dotaz",
        active: false 
    },
    { text: "#Objednavka", active: false },
    { text: "#Kurzy", active: false },
    { text: "#E-shop", active: false }
]

export default function CTA({ text, kind }: {text: string, kind: "primary" | "secondary"}) {
    const tagValue = useState<Tags>([
        { text: "#Dotaz", active: false }
    ]);

    return (
        <div className="CTA__block">
            <div className="button">
                <div className="bg">
                    <Image src="/assets/img/cta_bg.png" alt="CTA background" fill/>
                </div>
                <div className="text">
                    <p>{text}</p>
                </div>
            </div>
            <div className="form__container">
                <div className="form__wrapper">
                    <div className="header">

                    </div>
                    <div className="form__content">
                        <div className="pillar">

                        </div>
                        <div className="form__inner">
                            <form className="form">
                                <div className="header">
                                    <p>Vyplnte formu dole</p>
                                </div>
                                <div className="form__inputs">
                                    <FormInput label="Jméno" placeholder="Zadejte své jméno"/>
                                    <FormInput label="E-mail" placeholder="Zadejte svůj e-mail"/>
                                    <FormInputPhone label="Telefon" placeholder="Zadejte svůj telefon"/>
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
                    </div>
                </div>
                <div className="image">
                    <div className="image__wrapper">
                        <Image src="/assets/img/cta_img.png" alt="CTA image" fill style={{objectFit: "cover"}}/>
                    </div>
                </div>
            </div>
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

            <div className="iput">
                <List items={["+420", "+421", "+43"]}/>
                <input type="tel" id={label} placeholder={placeholder}/>
            </div>
        </div>
    )
}
const FormTextArea = ({ label, placeholder }: { label: string, placeholder: string }) => {
    return (
        <div className="form__input">
            <label htmlFor={label}>{label}</label>
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