import { Metadata } from "next"

import { getMerchantIdentity } from "@lib/data/merchant"
import LegalDocument, {
  type LegalSectionData,
} from "@modules/legal/LegalDocument"

import ProtocolDownload from "./download"

const merchant = getMerchantIdentity()

export const metadata: Metadata = {
  title: "Reklamační protokol",
  description:
    "Formulář pro uplatnění reklamace zboží z Keramické zahrady — postup krok za krokem a protokol ke stažení.",
}

const sections: LegalSectionData[] = [
  {
    id: "kdy-reklamovat",
    title: "Kdy zboží reklamovat",
    paragraphs: [
      "Reklamaci uplatňujete, pokud má zboží vadu — dorazilo poškozené, neodpovídá objednávce nebo se vada projeví během záruční doby. U zboží zakoupeného jako spotřebitel máte na uplatnění práv z vadného plnění dva roky od převzetí.",
      "Ruční výroba s sebou nese drobné odchylky v odstínu glazury, struktuře povrchu a rozměrech. Nejde o vadu — je to vlastnost každého originálu. Reklamace se týká skutečných vad: prasklin, odštěpků, odlupující se glazury nebo poškození při přepravě.",
    ],
  },
  {
    id: "postup",
    title: "Jak reklamaci uplatnit",
    paragraphs: ["Stačí tři kroky:"],
    bullets: [
      "Připravte si číslo objednávky, popis vady a fotografie — na fotografii bývá vada zřejmá na první pohled.",
      `Napište nám na ${merchant.email}. Máte-li vyplněný reklamační protokol, přiložte ho; bez něj to jde také.`,
      `Ozveme se vám s dalším postupem. Zboží posílejte až po naší odpovědi, na adresu ${merchant.address}.`,
    ],
  },
  {
    id: "lhuty",
    title: "Lhůty a vyřízení",
    paragraphs: [
      "Reklamaci vyřídíme nejpozději do 30 dnů od jejího uplatnění. O přijetí i o výsledku vás vyrozumíme e-mailem.",
      "Za okamžik uplatnění reklamace se považuje chvíle, kdy jsme od vás obdrželi reklamované zboží.",
      "Náklady na dopravu při oprávněné reklamaci hradíme my.",
    ],
  },
  {
    id: "kontakt",
    title: "Na koho se obrátit",
    paragraphs: [
      `${merchant.name}, se sídlem ${merchant.address}, IČO ${merchant.registrationNumber}`,
      `E-mail: ${merchant.email}`,
      `Telefon: ${merchant.phone}`,
    ],
  },
]

export default function Page() {
  return (
    <LegalDocument
      code="PRÁVO · 06"
      eyebrow="Reklamace · postup"
      title="Reklamační protokol"
      accent="Když něco není v pořádku."
      description="Formulář a postup pro uplatnění reklamace. Napište nám dřív, než zboží odešlete — často se domluvíme rychleji."
      sections={sections}
      supplements={{ postup: <ProtocolDownload /> }}
    />
  )
}
