import { Metadata } from "next"

import { getMerchantIdentity } from "@lib/data/merchant"
import LegalDocument, {
  type LegalSectionData,
} from "@modules/legal/LegalDocument"

const merchant = getMerchantIdentity()

export const metadata: Metadata = {
  title: "Ochrana osobních údajů",
  description:
    "Jaké osobní údaje o vás zpracováváme, proč je potřebujeme, jak dlouho je uchováváme a jaká práva k nim máte.",
}

const sections: LegalSectionData[] = [
  {
    id: "uvod",
    title: "Zásady ochrany osobních údajů",
    paragraphs: [
      "Jsme společnost, která bere ochranu dat a soukromí velmi vážně. Jsme odhodláni chránit vaše osobní údaje a být transparentní ohledně toho, jaké informace o vás máme.",
    ],
  },
  {
    id: "jak-shromazdujeme",
    title: "Jaké údaje shromažďujeme?",
    paragraphs: [
      "Shromažďujeme osobní údaje od vás, když nám je přímo poskytujete, a také prostřednictvím vašeho využívání našich služeb.",
      "Tyto informace mohou zahrnovat:",
    ],
    bullets: [
      "Informace, které nám poskytnete, když používáte naše služby nebo se registrujete k účtu.",
      "Informace, které poskytnete při účasti na jakýchkoli interaktivních funkcích služeb.",
      "Korespondenci nebo jiné informace, které nám zasíláte.",
      "Informace shromážděné při používání našich služeb.",
    ],
  },
  {
    id: "jak-pouzivame",
    title: "Jak používáme vaše údaje?",
    paragraphs: [
      "Vaše údaje používáme k poskytování, podpoře, personalizaci a rozvoji našich služeb.",
      "Jak používáme vaše osobní údaje, závisí na tom, jakým způsobem interagujete s našimi službami a na volbách, které děláte.",
      "Používáme údaje, které máme o vás, k poskytování a personalizaci našich služeb, aby byly relevantnější a užitečnější pro vás i ostatní.",
    ],
  },
  {
    id: "novinky-e-mailem",
    title: "Novinky e-mailem",
    paragraphs: [
      "Pokud jste se přihlásili k odběru novinek, u rozeslaných e-mailů měříme jejich otevření a kliknutí na odkazy, abychom zlepšovali jejich obsah — odhlášením z odběru toto měření končí.",
    ],
  },
  {
    id: "sdileni",
    title: "Sdílíme vaše údaje?",
    paragraphs: [
      "Vaše údaje budeme sdílet s třetími stranami pouze způsoby uvedenými v těchto zásadách ochrany osobních údajů.",
      "Můžeme zpřístupnit třetím stranám údaje, které byly anonymizovány tak, aby nemohly být použity k vaší identifikaci.",
      "Můžeme sdílet vaše údaje s:",
    ],
    bullets: [
      "Společnostmi v rámci naší skupiny",
      "Našimi poskytovateli služeb třetích stran",
      "Našimi obchodními partnery",
    ],
  },
  {
    id: "pravni-zaklad",
    title: "Právní základ zpracování",
    paragraphs: ["Vaše osobní údaje zpracováváme na základě:"],
    bullets: [
      "Váš souhlas",
      "Plnění smlouvy",
      "Naše oprávněné zájmy",
      "Plnění právních povinností",
    ],
  },
  {
    id: "doba-uchovavani",
    title: "Doba uchovávání údajů",
    paragraphs: [
      "Vaše osobní údaje uchováváme pouze po dobu nezbytně nutnou k naplnění účelů uvedených v těchto zásadách, obvykle po dobu trvání vašeho účtu plus 24 měsíců, nebo dokud neodvoláte svůj souhlas.",
    ],
  },
  {
    id: "prava",
    title: "Vaše práva",
    paragraphs: ["Podle GDPR máte právo na:"],
    bullets: [
      "Přístup k vašim údajům",
      "Opravu údajů",
      "Výmaz údajů",
      "Přenositelnost údajů",
      "Vznesení námitky",
      "Odvolání souhlasu",
      `Pro uplatnění těchto práv nás kontaktujte na ${merchant.email}.`,
    ],
  },
  {
    id: "mezinarodni-prenosy",
    title: "Mezinárodní přenosy",
    paragraphs: [
      "Pokud přenášíme vaše údaje mimo EU/EHP, zajišťujeme odpovídající úroveň ochrany pomocí standardních smluvních doložek schválených Evropskou komisí nebo jiných vhodných záruk.",
    ],
  },
  {
    id: "kontakt-spravce",
    title: "Kontakt na správce údajů",
    paragraphs: [
      `Správcem vašich osobních údajů je ${merchant.name}, se sídlem ${merchant.address}, IČO ${merchant.registrationNumber}.`,
      `Máte-li jakékoliv dotazy týkající se zpracování vašich osobních údajů, napište nám na ${merchant.email} nebo zavolejte na ${merchant.phone}.`,
    ],
  },
]

export default function Page() {
  return (
    <LegalDocument
      code="GDPR · 02"
      eyebrow="Soukromí"
      title="Ochrana osobních údajů"
      accent="Vaše údaje zůstávají vaše."
      description="Jaké údaje o vás máme, k čemu je potřebujeme a co s nimi můžete udělat."
      sections={sections}
    />
  )
}
