import { Metadata } from "next"

import { getMerchantIdentity } from "@lib/data/merchant"
import { getFiles, getPageCopy } from "@lib/data/site-copy"
import LegalDownloads from "@modules/legal/Downloads"
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
    /*
     * Transport damage is the one case where the claim is not ours to settle, and the
     * customer has two working days to act. It is therefore stated plainly and placed
     * before the general procedure — a rule discovered on day three is a rule that cost
     * somebody a pot.
     *
     * TODO: add the document — the prefilled claim form, once it exists, is linked from
     * here and from the block on the order pages.
     */
    id: "poskozeni-pri-preprave",
    title: "Poškození při přepravě",
    paragraphs: [
      "Zásilku si prosím prohlédněte hned při převzetí, ještě než ji podepíšete. Je-li obal promáčklý, protržený nebo něčím prosakuje, rozbalte ji přímo před doručovatelem. U keramiky to platí dvojnásob — rozbije se tiše a zvenku bývá krabice v pořádku.",
      "Reklamaci poškození způsobeného přepravou uplatňuje u dopravce příjemce zásilky, tedy vy. Jako odesílatel ji za vás podat nemůžeme. Podle podmínek České pošty je nutné poškození nahlásit při převzetí, nejpozději do dvou pracovních dnů od doručení — po této lhůtě už reklamaci nepřijme.",
      "Reklamaci podáte na kterékoli pobočce České pošty nebo online v jejich eReklamaci (ceskaposta.cz/ereklamace). Přiložte fotografie obalu i obsahu a doklad o ceně zboží. Česká pošta má na vyřízení 15 dnů.",
      "Pokud zásilku převezmete bez výhrad a poškození nahlásíte až po uvedené lhůtě, dopravce reklamaci zamítne a zboží zůstává vaše — náhradu v takovém případě nemůžeme poskytnout. Proto prosíme: raději otevřít před doručovatelem.",
      "Dejte nám prosím vědět i tak. O poškozené zásilce chceme vědět, i když ji řeší dopravce, a rádi vám s postupem poradíme.",
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

export default async function Page() {
  // Znění kapitol z CMS; `sections` níž zůstávají zálohou pro výpadek.
  const [copy, files] = await Promise.all([
    getPageCopy("reklamacni-protokol"),
    getFiles("reklamacni-protokol"),
  ])

  return (
    <LegalDocument
      code="06"
      eyebrow="Reklamace · postup"
      title="Reklamační protokol"
      accent="Když něco není v pořádku."
      description="Jak reklamaci podat a co k ní potřebujete. Napište nám dřív, než zboží pošlete — často se domluvíme rychleji."
      sections={sections}
      block={copy["reklamacni-protokol.text"]}
      downloads={<LegalDownloads files={files} />}
      supplements={{ postup: <ProtocolDownload /> }}
    />
  )
}
