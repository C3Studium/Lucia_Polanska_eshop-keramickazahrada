import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React from "react"
import styles from "../styles/help.module.scss"

const Help = () => {
  // WIP: add here correct contact information
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Potřebujete s něčím pomoct?</h2>
      <div className={styles.content}>
        <ul className={styles.list}>
          <li>
            <div className={styles.contact}>
              <p className={styles.contactHeader}>
                Kontakt
                <a className={styles.contactInfo} href="tel:+420775211578">
                  +420 775 211 578
                </a>
                <a
                  className={styles.contactInfo}
                  href="mailto:info@keramickazahrada.cz"
                >
                  info@keramickazahrada.cz
                </a>
              </p>
            </div>
          </li>
          <li>
            <LocalizedClientLink href="/odstoupeni-od-smlouvy" className={styles.link}>
              Reklamace a výměny
            </LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Help
