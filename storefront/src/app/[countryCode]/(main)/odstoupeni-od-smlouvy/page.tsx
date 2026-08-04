import { Metadata } from "next"

import LegalDocument, {
  type LegalSectionData,
} from "@modules/legal/LegalDocument"

export const metadata: Metadata = {
  title: "Odstoupení od smlouvy",
  description:
    "Jak vrátit zboží do 14 dnů od převzetí — postup, lhůty a vzorové oznámení o odstoupení od kupní smlouvy.",
}

const sections: LegalSectionData[] = [
  {
    id: "uvod",
    title: "Oznámení o odstoupení od kupní smlouvy (spotřebitel)",
    paragraphs: [],
  },
  {
    id: "kupujici",
    title: "Kupující",
    paragraphs: [
      "Jméno a příjmení …………………………………",
      "Adresa …………………………………",
      "…………………………………",
      "Telefon a e­mail …………………………………",
    ],
  },
  {
    id: "prodavajici",
    title: "Prodávající",
    paragraphs: [
      "Keramická Zahrada s.r.o., se sídlem Putim 229, 397 01 Písek",
      "identifikační číslo: 03441482",
    ],
  },
  {
    id: "text",
    title: "Text oznámení",
    paragraphs: [
      "Vážení,",
      "dne …………………….… jsem prostřednictvím vašeho e­shopu www.eshop.cheesemafia.cz s vámi uzavřel(a) kupní smlouvu: číslo daňového dokladu (faktury) ………………………, na základě které jsem převzal dne ……………… zboží:",
      "Vzhledem k tomu, že smlouva byla uzavřena pomocí internetu, tj. typického prostředku komunikace na dálku, rozhodl(a) jsem se využít svého práva podle ustanovení § 1829 odst. 1 ve spojení s § 1818 zákona č. 89/2012 Sb., občanského zákoníku, a tímto oznamuji, že od výše uvedené kupní smlouvy odstupuji.",
    ],
  },
  {
    id: "rozsah",
    title: "Rozsah odstoupení",
    paragraphs: ["(zvolte jednu z možností, nehodící se škrtněte):"],
    bullets: [
      "a) Od smlouvy odstupuji v plném rozsahu a vracím vše, co je uvedeno na faktuře.",
      "b) Od smlouvy odstupuji v částečném rozsahu, tj. pouze co do níže uvedeného zboží:",
      "",
    ],
  },
  {
    id: "prohlaseni",
    title: "Prohlášení",
    paragraphs: [
      "Prohlašuji, že výše uvedené zboží není zbožím uvedeným v ust. § 1837 zákona č. 89/2012 Sb., občanského zákoníku, tedy jsem oprávněn co do uvedeného zboží od kupní smlouvy odstoupit a nenastala skutečnost, která by mé právo odstoupení od smlouvy vyloučila nebo omezila.",
      "Zboží vám zasílám zpět a zároveň vás žádám o poukázání kupní ceny včetně účtovaného dopravného (uvedeno na daňovém dokladu) ve výši ………………,- Kč, ve prospěch mého bankovního účtu č. ……………………………………………… nejpozději do 14 kalendářních dnů od doručení tohoto odstoupení od smlouvy.",
    ],
  },
  {
    id: "datum-a-podpis",
    title: "Datum a podpis",
    paragraphs: [
      "V ……………………, dne …………",
      "",
      "Datum ......................     Podpis kupujícího..............................................",
    ],
  },
]

export default function Page() {
  return (
    <LegalDocument
      code="FORM · 03"
      eyebrow="Vrácení · krok za krokem"
      title="Odstoupení od smlouvy"
      accent="Jednoduše a bez nejistoty."
      description="Vzor oznámení a všechny údaje potřebné k odstoupení od kupní smlouvy na jednom místě."
      sections={sections}
    />
  )
}
