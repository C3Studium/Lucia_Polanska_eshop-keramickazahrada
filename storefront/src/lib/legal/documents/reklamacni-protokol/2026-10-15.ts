import type { LegalDocumentVersion } from "../../types"

/**
 * Reklamační protokol platný od 15. 10. 2026 — praktický návod a formulář
 * k tisku. Pravidla jsou v Reklamačním řádu; tady je „jak na to".
 *
 * Přepravní poškození už NEPŘEHAZUJE reklamaci na zákazníka a Českou poštu
 * (LEGAL_AUDIT.md §4.1) a reklamace je uplatněna oznámením, ne doručením
 * zboží (§ 19 ZOS). Kotvy `kdy-reklamovat`, `poskozeni-pri-preprave`,
 * `postup`, `lhuty` a `kontakt` jsou převzaté z předchozího znění stránky,
 * aby staré odkazy dál vedly na správné místo.
 */
const reklamacniProtokol: LegalDocumentVersion = {
  slug: "reklamacni-protokol",
  title: "Reklamační protokol",
  version: "2026-10-15",
  summary:
    "Jak reklamaci podat a co k ní potřebujete — online, e-mailem nebo poštou. Formulář k vytištění je dole na stránce.",
  pdf: true,
  sections: [
    {
      id: "kdy-reklamovat",
      title: "Kdy zboží reklamovat",
      blocks: [
        {
          type: "p",
          text: "Reklamovat můžete, když má zboží vadu — dorazilo rozbité, neodpovídá objednávce nebo popisu, nebo se vada projeví později. Máte na to **2 roky od převzetí**. Projeví-li se vada během prvního roku, má se za to, že tu byla už při převzetí.",
        },
        {
          type: "p",
          text: "Ruční výroba s sebou nese drobné odchylky v odstínu glazury, struktuře povrchu a rozměrech. Nejde o vadu — je to vlastnost každého originálu. Reklamace se týká skutečných vad: prasklin, odštěpků, odlupující se glazury nebo poškození při přepravě. Co přesně vadou je a není, najdete v [Reklamačním řádu](/reklamacni-rad#co-neni-vadou).",
        },
      ],
    },
    {
      id: "poskozeni-pri-preprave",
      title: "Poškození při přepravě",
      blocks: [
        {
          type: "p",
          text: "Zásilku si prosím prohlédněte hned při převzetí. Je-li obal promáčklý, protržený nebo uvnitř něco chrastí, můžete ho otevřít před doručovatelem a poškození s ním zapsat, nebo zásilku nepřevzít. U keramiky to pomáhá — rozbije se tiše a zvenku bývá krabice v pořádku. Je to ale **prosba, ne podmínka**.",
        },
        {
          type: "p",
          text: "Dorazilo něco rozbité? **Napište nám** — co nejdřív, s fotografiemi obalu i obsahu a s číslem objednávky. Je to běžná reklamace: domluvíme se na výměně nebo opravě, a když to nejde, vrátíme vám peníze.",
        },
        {
          type: "p",
          text: "**U České pošty nic reklamovat nemusíte** a žádná dvoudenní lhůta dopravce pro vás neplatí. Škodu s dopravcem vyřizujeme my. Krabici i s výplní si prosím nechte, než se domluvíme — dopravce ji někdy chce vidět.",
        },
      ],
    },
    {
      id: "postup",
      title: "Jak reklamaci podat",
      blocks: [
        { type: "p", text: "Vyberte si, co je vám nejpohodlnější:" },
        {
          type: "ol",
          items: [
            "**Online:** otevřete objednávku ve svém zákaznickém účtu (v části Objednávky), nebo přes odkaz na objednávku z e-mailu, a zvolte reklamaci. Popíšete vadu a nahrajete fotografie.",
            "**E-mailem** na {{seller.email}}: číslo objednávky, popis vady, fotografie a co požadujete — opravu, výměnu, slevu, nebo odstoupení od smlouvy. Můžete přiložit vyplněný formulář níže, ale nemusíte.",
            "**Poštou** na {{seller.name}}, {{seller.address}} — s formulářem, nebo s vlastním popisem.",
          ],
        },
        {
          type: "p",
          text: "Zboží nám zatím posílat nemusíte — často stačí fotografie. Je-li potřeba kus vidět, ozveme se s postupem.",
        },
      ],
    },
    {
      id: "lhuty",
      title: "Co se stane potom",
      blocks: [
        {
          type: "ul",
          items: [
            "Reklamace je uplatněná ve chvíli, kdy nám ji pošlete — e-mailem, online nebo dopisem. Od té chvíle máme **30 dnů** na její vyřízení, včetně odstranění vady, nedomluvíme-li se na delší lhůtě.",
            "Přijetí vám potvrdíme e-mailem: kdy jste reklamaci uplatnili, co reklamujete a jaké vyřízení požadujete.",
            "Po vyřízení vám pošleme potvrzení, jak a kdy jsme reklamaci vyřídili (u opravy i jak dlouho trvala), případně proč jsme ji zamítli.",
            "Kdybychom 30denní lhůtu nedodrželi, můžete od smlouvy odstoupit, nebo požadovat přiměřenou slevu.",
          ],
        },
      ],
    },
    {
      id: "naklady",
      title: "Kolik vás to stojí",
      blocks: [
        {
          type: "p",
          text: "Oprávněná reklamace vás nestojí nic. Poštovné za zaslání zboží k nám vám uhradíme — pošlete nám prosím doklad o jeho ceně. Opravené nebo nové zboží vám pošleme na naše náklady.",
        },
      ],
    },
    {
      id: "formular",
      title: "Reklamační formulář",
      blocks: [
        {
          type: "p",
          text: "Formulář si můžete vytisknout a poslat poštou, nebo vyplnit a přiložit k e-mailu jako fotografii či sken. Není povinný — stačí, když nám vadu popíšete jakkoli.",
        },
        {
          type: "form",
          title: "Reklamační protokol",
          fields: [
            {
              label: "Prodávající",
              value:
                "{{seller.name}}, {{seller.address}}, IČO {{seller.ico}}, e-mail {{seller.email}}, tel. {{seller.phone}}",
            },
            { label: "Kupující — jméno a příjmení" },
            { label: "Adresa" },
            { label: "E-mail a telefon" },
            { label: "Číslo objednávky a reklamovaný výrobek" },
            { label: "Datum převzetí zboží" },
            { label: "Popis vady (co se stalo a kdy jste si vady všimli)" },
            {
              label:
                "Požadovaný způsob vyřízení (oprava / výměna / přiměřená sleva / odstoupení od smlouvy)",
            },
            { label: "Číslo účtu pro případné vrácení peněz (nepovinné)" },
            { label: "Datum" },
            { label: "Podpis kupujícího" },
          ],
          note: "Přiložte prosím fotografie vady, a jde-li o poškození při přepravě, i fotografie obalu.",
        },
      ],
    },
    {
      id: "kontakt",
      title: "Na koho se obrátit",
      blocks: [
        {
          type: "p",
          text: "{{seller.name}}, se sídlem {{seller.address}}, IČO {{seller.ico}}",
        },
        { type: "p", text: "E-mail: {{seller.email}}" },
        { type: "p", text: "Telefon: {{seller.phone}}" },
        {
          type: "p",
          text: "Pravidla reklamací: [Reklamační řád](/reklamacni-rad) · [Obchodní podmínky](/smluvni-podminky#prava-z-vadneho-plneni)",
        },
      ],
    },
  ],
}

export default reklamacniProtokol
