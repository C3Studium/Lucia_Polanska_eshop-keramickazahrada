"use client";

import Magnetic from "@modules/common/components/Buttons/Magnetic";
import ScrollLink from "@modules/common/components/Buttons/ScrollLink";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { paymentIcons, paymentIconsWhite } from "constants/icons";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const currentYear = new Date().getFullYear()

const importantLinks = [
    {
        label: "Smluvní podmínky",
        href: "/smluvni-podminky"
    },
    {
        label: "Ochrana osobních údajů",
        href: "/ochrana-osobnich-udaju"
    },
    {
        label: "Obchodní podmínky",
        href: "/obchodni-podminky"
    }
]

const socialLinks = [
    {
        label: "Facebook",
        href: "https://www.facebook.com/keramickazahrada",
        icon: "/assets/icons/facebook.svg"
    },
    {
        label: "Instagram",
        href: "https://www.instagram.com/luciepolanska/",
        icon: "/assets/icons/instagram.svg"
    }
]

const links = [
    {
        label: "Kontakt",
        href: "/kontakt"
    },
    {
        label: "Dotazy",
        href: "/dotazy"
    },
    {
        label: "Kurzy",
        href: "/kurzy"
    }
]

const helpLinks = [
    {
        label: "Odstoupení od smlouvy",
        href: "/odstoupeni_od_smlouvy"
    },
    {
        label: "Doprava a platba",
        href: "/doprava-a-platba"
    },
    {
        label: "Reklamační protokol",
        href: "/reklamacni-protokol"
    } 
]

export default function Footer() {
  const pathname = usePathname();
  const params = useParams();
  const countryCode = params?.countryCode as string | undefined;


    return (
        <footer
            className="footer"
        >
            <div className="Upper__footer">
                <div className="div"/>
                <div className="content__upperFooter">
                    <div className="Links">
                        <div className="Important">
                            <h3>
                                Důležité odkazy
                            </h3>

                            <div className="main__Links">
                                {importantLinks.map((link, index) => (
                                    <FooterLink key={index} href={link.href} label={link.label} />
                                ))}
                            </div>
                        </div>
                        <div className="Social">
                            <h3>
                                Sledujte mě
                            </h3>

                            <div className="social__icons">
                                {socialLinks.map((link, index) => (
                                    <FooterIcon key={index} href={link.href} icon={link.icon} />
                                ))}
                            </div>
                        </div>
                        <div className="Need__help">
                            <h3>
                                Potřebujete pomoc?
                            </h3>
                            <div className="links">
                                {links.map((link, index) => (
                                    <FooterLink key={index} href={link.href} label={link.label} />
                                ))}
                                <div className="divider"/>
                                <div className="divider"/>
                            </div>
                            <div className="main__Links">
                                {helpLinks.map((link, index) => (
                                    <FooterLink key={index} href={link.href} label={link.label} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="newsletter">
                        <h3>
                            Přihlaste se k odběru novinek
                        </h3>
                        <Newsletter />
                    </div>
                </div>
            </div>
            <div className="Bottom__footer">
                <div className="Main">
                    <div className="Logo">
                        <div className="imgWrapper">
                            <Image src="/assets/icons/logo.svg" alt="logo" width={50} height={50}/>
                        </div>
                        <div className="Name">
                            <h2>Keramická zahrada</h2>
                            <p>Lucie Polanská</p>
                        </div>

                    </div>
                    <div className="makers">
                        <p>
                            Design&Code by <LocalizedClientLink href="https://www.matejforejt.com" className="maker__link">C3Studium</LocalizedClientLink>
                        </p>
                    </div>
                </div>
                <div className="div"/>
                <div className="bottom">
                    <div className="payment__links">
                        <div className="payment__logos">
                            {paymentIconsWhite.map((icon, index) => (
                                <FooterIcon key={index} icon={icon.src} href={icon.href} />
                            ))}
                        </div>
                        <p>
                            © {currentYear} Keramická zahrada. Všechna práva vyhrazena.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}


const FooterLink = ({href, label}: {href: string, label: string}) => {
    return (
        <LocalizedClientLink href={href} className="footer__link">
            <p>
                {label}
            </p>
        </LocalizedClientLink>
    )
}
const FooterIcon = ({href, icon}: {href: string, icon: string}) => {
    return (
        <LocalizedClientLink href={href} className="footer__link">
            <Image src={icon} alt={`${icon}__icon`} width={20} height={20}/>
        </LocalizedClientLink>
    )
}

const Newsletter = () => {
    return (
        <div className="newsletter__container">
            <input type="email" placeholder="Zadejte svůj E-mail" className="newsletter__input"/>
            <NewsButton />
        </div>
    );
}

const NewsButton = () => {
    return (
        <button className="newsletter__button">
            <p>Odebírat</p>
        </button>
    );
}