"use client"

import { useLegalFacts } from "@lib/legal/facts-context"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React from "react"
import styles from "../styles/help.module.scss"

/** `+420 775 211 578` → `tel:+420775211578`. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

const Help = () => {
  // Kontakt z Právních údajů (administrace obchodu), ne napevno — změní-li
  // Lucie telefon nebo e-mail, má se změnit i tady. Fakt může chybět
  // (`null` = nevyplněno); pak se řádek vynechá místo prázdného odkazu.
  const facts = useLegalFacts()
  const phone = facts["seller.phone"]
  const email = facts["seller.email"]

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Potřebujete s něčím pomoct?</h2>
      <div className={styles.content}>
        <ul className={styles.list}>
          <li>
            <div className={styles.contact}>
              <p className={styles.contactHeader}>
                Kontakt
                {phone ? (
                  <a className={styles.contactInfo} href={telHref(phone)}>
                    {phone}
                  </a>
                ) : null}
                {email ? (
                  <a className={styles.contactInfo} href={`mailto:${email}`}>
                    {email}
                  </a>
                ) : null}
              </p>
            </div>
          </li>
          {/* Reklamace (vada) a vrácení bez udání důvodu (odstoupení) jsou dvě
              různá práva s vlastními pravidly — každé na svou stránku. */}
          <li>
            <LocalizedClientLink href="/reklamacni-rad" className={styles.link}>
              Reklamace a výměny
            </LocalizedClientLink>
          </li>
          <li>
            <LocalizedClientLink href="/odstoupeni-od-smlouvy" className={styles.link}>
              Vrácení do 14 dnů
            </LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Help
