import { Metadata } from "next"

import LegalDocument, {
  type LegalSectionData,
} from "@modules/legal/LegalDocument"

export const metadata: Metadata = {
  title: "Používání cookies",
  description:
    "Co soubory cookies znamenají, k čemu je v Keramické zahradě používáme a jak jejich ukládání ovládáte ve svém prohlížeči.",
}

const sections: LegalSectionData[] = [
  {
    id: "o-cookies",
    title: "O souborech cookies",
    paragraphs: [
      "Soubory cookie jsou malé textové soubory, které webové stránky, které navštívíte, ukládají do vašeho počítače. Webové stránky používají soubory cookie, aby uživatelům umožnily efektivně se orientovat a provádět určité funkce. Soubory cookie, které jsou vyžadovány pro správné fungování webových stránek, je možné nastavovat bez Vašeho svolení. Všechny ostatní soubory cookie je nutné před nastavením v prohlížeči schválit. Svůj souhlas s používáním souborů cookie můžete na naší stránce Zásady ochrany osobních údajů kdykoli změnit na konci této stránky.",
    ],
  },
  {
    id: "prohlaseni",
    title: "Prohlášení o souborech cookie",
    paragraphs: ["Cookies"],
  },
  {
    id: "cookies-def",
    title: "Cookies",
    paragraphs: [
      "Cookies jsou malé textové soubory, které jsou umístěny na vašem počítači webovými stránkami, které navštěvujete. Jsou hojně používány, aby webové stránky fungovaly nebo fungovaly efektivněji, a také k poskytování informací vlastníkům stránek.",
    ],
  },
  {
    id: "jak-pouzivame",
    title: "Jak používáme cookies",
    paragraphs: [
      "Používáme cookies, abychom zlepšili vaši zkušenost s webovými stránkami. Tato politika cookies je součástí naší politiky ochrany soukromí a pokrývá používání cookies mezi vaším zařízením a naším webem. Také poskytujeme základní informace o službách třetích stran, které můžeme používat, a které mohou také používat cookies jako součást své služby, i když nejsou kryty naší politikou.",
    ],
  },
  {
    id: "typy",
    title: "Typy cookies",
    paragraphs: [
      "Existuje několik různých typů cookies, nicméně naše webové stránky používají: Funkční - Naše společnost používá tyto cookies, aby vás rozpoznala na našich webových stránkách a zapamatovala si vaše dříve vybrané preference. To může zahrnovat jazyk, který preferujete, a místo, kde se nacházíte. Používáme mix cookies první a třetí strany.",
    ],
  },
  {
    id: "ovladani",
    title: "Jak ovládat cookies",
    paragraphs: [
      "Cookies můžete ovládat a/nebo mazat podle svého uvážení – podrobnosti naleznete na aboutcookies.org. Můžete smazat všechny cookies, které jsou již na vašem počítači, a můžete nastavit většinu prohlížečů, aby zabránily jejich umístění. Pokud tak učiníte, možná budete muset při každé návštěvě webu ručně upravovat některé preference a některé služby a funkce nemusí fungovat.",
    ],
  },
  {
    id: "pouziti",
    title: "Použití cookies",
    paragraphs: [
      "Cookie je malý textový dokument, který je kopírován na Váš hard disk z webové stránky. Cookies nezpůsobují žádné poškození Vašeho počítače, ani neobsahují žádné viry. Cookies z naší stránky nesbírají žádná Vaše osobní data. Používání cookies můžete kdykoli zakázat v nastavení Vašeho prohlížeče. Cookies na našich stránkách jsou používány pouze po dobu Vaší návštěvy pro zaručení anonymity, statistické potřeby a zlepšení rozhraní pro uživatele. Tyto stránky využívají pouze cookies, které slouží k zajištění funkčnosti stránek a ke zvýšení Vašeho uživatelského komfortu. Prostřednictvím cookies nesbíráme jakákoli data o uživatelích stránek, zejména pak nedochází ke sběru osobních údajů. V případě, že nebudete s nahráním cookies do vašeho počítače souhlasit, můžete odmítnou instalaci cookies nastavením Vašeho internetového prohlížeče, standardně v kartě Nastavení / nastavení obsahu / soubory cookie.",
    ],
  },
  {
    id: "nezbytne",
    title: "Nezbytné cookies",
    paragraphs: [
      "Tyto cookies jsou nezbytné pro fungování webových stránek. Zahrnují například cookies, které umožňují přihlášení do zabezpečených částí webu. Tyto cookies nemohou být vypnuty.",
    ],
  },
  {
    id: "preferencni",
    title: "Preferenční cookies",
    paragraphs: [
      "Tyto cookies umožňují webové stránce zapamatovat si volby, které jste učinili (například preferovaný jazyk nebo region) a poskytnout vylepšené, personalizovanější funkce. Doba uchovávání těchto cookies je 6 měsíců.",
    ],
  },
  {
    id: "treti-strany",
    title: "Cookies třetích stran",
    paragraphs: [
      "Náš web používá služby třetích stran jako Google Analytics a sociální média. Tyto služby mohou ukládat cookies pro analytické účely a měření výkonu. Kompletní seznam třetích stran a jejich cookies je k dispozici v nastavení cookies.",
    ],
  },
]

export default function Page() {
  return (
    <LegalDocument
      code="DATA · 05"
      eyebrow="Cookies"
      title="Používání cookies"
      accent="Krátce a jasně."
      description="Co cookies jsou, k čemu je používáme a jak si je můžete v prohlížeči vypnout."
      sections={sections}
    />
  )
}
