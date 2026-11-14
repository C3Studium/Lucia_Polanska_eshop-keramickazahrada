"use client"

import { useLegalFacts } from "@lib/legal/facts-context"
import s from "./style.module.scss"

/**
 * Pomoc po telefonu v kroku Platba (14. 11. 2026). Platba je místo, kde
 * starší zákazníci nejčastěji znejistí a odejdou; číslo na Lucii jim dá jistotu,
 * že na druhé straně je člověk. Číslo z Právních údajů v administraci.
 */
export default function PomocTelefonem() {
  const facts = useLegalFacts()
  const telefon = String(facts["seller.phone"] ?? "").trim()
  if (!telefon || telefon.includes("DOPLNIT")) return null
  const odkaz = `tel:${telefon.replace(/[^\d+]/g, "")}`
  return (
    <p className={s.root}>
      Nevíte si s platbou rady? Zavolejte nám:{" "}
      <a href={odkaz} className={s.cislo}>
        {telefon}
      </a>
    </p>
  )
}
