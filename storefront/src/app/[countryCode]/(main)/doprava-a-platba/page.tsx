"use client"

import LegalDocument, {
  type LegalSectionData,
} from "@modules/legal/LegalDocument"

const sections: LegalSectionData[] = [
  {
    id: "uvod",
    title: "Doprava a platba",
    paragraphs: [],
  },
  {
    id: "cz-doprava",
    title: "Doprava v České republice",
    paragraphs: [],
  },
  {
    id: "cz-vydejni-mista",
    title: "Doručení na výdejní místa (CZ)",
    paragraphs: [
      "cena služby je 79 Kč včetně DPH",
      "doručení od zabalení zásilky do 1-2 pracovních dnů",
    ],
  },
  {
    id: "cz-adresa",
    title: "Doručení na adresu (CZ)",
    paragraphs: [
      "cena služby je 95 Kč včetně DPH",
      "doručení od zabalení zásilky do 1-3 pracovních dnů",
    ],
  },
  {
    id: "cz-doprava-zdarma",
    title: "Doprava zdarma (CZ)",
    paragraphs: [
      "Při nákupu nad 1000 Kč nabízíme dopravu zdarma, doprava zdarma se vztahuje pouze při zvolení typu doručení na výdejní místa. Akce doprava zdarma tedy neplatí pro doručení přímo na adresu. Akce platí pouze pro dodání do České republiky",
    ],
  },
  {
    id: "cz-vydejni-mista-2",
    title: "Doručení na výdejní místa (CZ, varianta 2)",
    paragraphs: [
      "cena služby je 89 Kč včetně DPH",
      "doručení od zabalení zásilky do 1-2 pracovních dnů",
    ],
  },
  {
    id: "cz-adresa-2",
    title: "Doručení na adresu (CZ, varianta 2)",
    paragraphs: [
      "cena služby je 99 Kč včetně DPH",
      "doručení od zabalení zásilky do 1-3 pracovních dnů",
    ],
  },
  {
    id: "cz-adresa-3",
    title: "Doručení na adresu (CZ)",
    paragraphs: [
      "cena služby je 99 Kč včetně DPH",
      "doručení od zabalení zásilky do 1-2 pracovních dnů",
    ],
  },
  {
    id: "dorucovaci-doba",
    title: "Doručovací doba",
    paragraphs: [
      "Vždy se Vám snažíme zboží doručit co nejdříve. Každý kryt vytváříme na zakázku, jedná se o ruční práci, žádná sériová výroba. Zásilka Vám tedy dorazí za 1-3 pracovní dny od vytvoření objednávky.",
      "Po zabalení zboží Vám automaticky od nás dorazí e-mail, že je zboží zabaleno a nyní se pouze čeká na předání dopravci",
    ],
  },
  {
    id: "cz-platba",
    title: "Platba v České republice",
    paragraphs: [],
  },
  {
    id: "comgate-popis",
    title: "Online platby (ComGate)",
    paragraphs: [
      "Online platby pro nás zajišťuje platební brána ComGate. Poskytovatel služby, společnost ComGate Payments, a.s., je licencovaná Platební instituce působící pod dohledem České národní banky. Platby probíhající skrze platební bránu jsou plně zabezpečeny a veškeré informace jsou šifrovány.",
    ],
  },
  {
    id: "platba-kartou",
    title: "Platba kartou",
    paragraphs: [
      "Nejrychlejší způsob zaplacení online. Do rozhraní platební brány ComGate zadáte číslo karty, datum platnosti a CVC kód – tři čísla, která najdete v podpisovém proužku na zadní straně karty. Vše je zabezpečeno standardem 3D Secure, a tak budete nejspíš požádáni o zadání číselného kódu, který obdržíte SMSkou od své banky.",
    ],
  },
  {
    id: "platba-prevodem",
    title: "Platba bankovním převodem",
    paragraphs: [
      "Okamžitá platba prostřednictvím internetového bankovnictví. Platební brána ComGate vás přesměruje do vašeho internetového bankovnictví, kam se přihlásíte jako obvykle a zde potvrdíte už připravený platební příkaz.",
      "Po dokončení platby budete přesměrováni zpět do obchodu. Platba je potvrzena okamžitě, budeme bez odkladu pokračovat v realizaci objednávky.",
    ],
  },
  {
    id: "platim-pak",
    title: "Odložená platba PlatímPak",
    paragraphs: [
      "Díky PlatímPak máte své zboží hned a platit přitom můžete klidně až za 30 dní. A to bez úroků nebo poplatků navíc.",
      "Službu PlatímPak zajišťuje společnost Equa Bank, a.s. a více informací se dozvíte přímo na stránkách Equa Bank",
    ],
  },
  {
    id: "dobirka",
    title: "Platba na dobírku",
    paragraphs: [
      "Objednávku zaplatíte až při převzetí zboží. Společnost Česká pošta, Zásilkovna a PPL umožňuje přijímat platby hotově nebo platební kartou. Poplatek za platbu na dobírku je 55 Kč a pokrývá náklady, které hradíme přepravci při vybírání dobírky.",
    ],
  },
  {
    id: "prevod-qrcode",
    title: "Převodem (možnost platby přes QR kód)",
    paragraphs: [
      "Klasický převod na náš bankovní účet, který zadáte v internetovém bankovnictví. Objednávka může být zpracována až po připsání platby na náš účet.",
      "Číslo účtu: 2500675505/2010",
      "IBAN: CZ55 2010 0000 0027 0128 1289",
      "BIC (SWIFT) kód: FIOBCZPP",
      "Variabilní symbol: vždy číslo objednávky",
    ],
  },
  {
    id: "kontakt-comgate",
    title: "Kontakty na platební bránu",
    paragraphs: [
      "ComGate Payments, a.s.",
      "Gočárova třída 1754 / 48b, Hradec Králové",
      "E-mail: platby-podpora@comgate.cz",
      "Tel:  +420 228 224 267",
    ],
  },
  {
    id: "neuspesna-platba",
    title: "Co když se mi platba nepovede?",
    paragraphs: [
      "I toto se bohužel může stát - klidně nám napište nebo zavolejte a společně dořešíme. Peníze rovněž můžete zaslat přímo na náš bankovní účet.",
      "Jako variabilní symbol vždy uveďte číslo objednávky.",
      "Číslo účtu: 7010757121/2010",
    ],
  },
  {
    id: "sk-doprava",
    title: "Doprava na Slovensko",
    paragraphs: [
      'Vaši objednávku Vám můžeme doručit také na Slovensko. V horním rohu e-shopu si můžete přepnout měnu na EUR a automaticky se Vám ceny na e-shopu přepočítají. V objednávkovém formuláři následně musíte zvolit zemi dodání "Slovensko".',
    ],
  },
  {
    id: "sk-vydejni-mista",
    title: "Doručení na výdejní místa (SK)",
    paragraphs: [
      "cena služby je 3,5 EUR včetně DPH",
      "doručení od zabalení zásilky do 1-3 pracovních dnů",
    ],
  },
  {
    id: "sk-adresa",
    title: "Doručení na adresu (SK)",
    paragraphs: [
      "cena služby je 5 EUR včetně DPH",
      "doručení od zabalení zásilky do 1-3 pracovních dnů",
      "Pro Slovensko bohužel zatím není poskytována doprava zdarma.",
    ],
  },
  {
    id: "sk-platba",
    title: "Platba na Slovensku",
    paragraphs: [],
  },
  {
    id: "sk-comgate-popis",
    title: "Online platby (ComGate, SK)",
    paragraphs: [
      "Online platby pro nás zajišťuje platební brána ComGate. Poskytovatel služby, společnost ComGate Payments, a.s., je licencovaná Platební instituce působící pod dohledem České národní banky. Platby probíhající skrze platební bránu jsou plně zabezpečeny a veškeré informace jsou šifrovány.",
    ],
  },
  {
    id: "sk-platba-kartou",
    title: "Platba kartou (SK)",
    paragraphs: [
      "Nejrychlejší způsob zaplacení online. Do rozhraní platební brány ComGate zadáte číslo karty, datum platnosti a CVC kód – tři čísla, která najdete v podpisovém proužku na zadní straně karty. Vše je zabezpečeno standardem 3D Secure, a tak budete nejspíš požádáni o zadání číselného kódu, který obdržíte SMSkou od své banky.",
    ],
  },
  {
    id: "sk-platba-prevodem",
    title: "Platba bankovním převodem (SK)",
    paragraphs: [
      "Okamžitá platba prostřednictvím internetového bankovnictví. Platební brána ComGate vás přesměruje do vašeho internetového bankovnictví, kam se přihlásíte jako obvykle a zde potvrdíte už připravený platební příkaz.",
      "Po dokončení platby budete přesměrováni zpět do obchodu. Platba je potvrzena okamžitě, budeme bez odkladu pokračovat v realizaci objednávky.",
    ],
  },
  {
    id: "sk-prevod-qrcode",
    title: "Převodem (QR, SK)",
    paragraphs: [
      "Klasický převod na náš bankovní účet, který zadáte v internetovém bankovnictví. Objednávka může být zpracována až po připsání platby na náš účet.",
      "Číslo účtu: 2701281289/2010",
      "IBAN: CZ55 2010 0000 0027 0128 1289",
      "BIC (SWIFT) kód: FIOBCZPP",
      "Variabilní symbol: vždy číslo objednávky",
    ],
  },
]

export default function Page() {
  return (
    <LegalDocument
      code="SERVIS · 04"
      eyebrow="Od ateliéru k vám"
      title="Doprava a platba"
      accent="Bezpečně zabalené. Jasně doručené."
      description="Možnosti dopravy, ceny, doručovací časy a bezpečné způsoby platby přehledně podle místa objednávky."
      sections={sections}
    />
  )
}
