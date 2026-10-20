import type { LegalDocumentVersion } from "../../types"

/**
 * Reklamační řád platný od 15. 10. 2026 — samostatný dokument s pravidly
 * (LEGAL_AUDIT.md §4, §6 „Patička: Reklamační řád"). Praktický návod
 * a formulář je Reklamační protokol; obchodní podmínky čl. XII jsou shrnutí.
 *
 * OZ = zákon č. 89/2012 Sb., ZOS = zákon č. 634/1992 Sb.
 */
const reklamacniRad: LegalDocumentVersion = {
  slug: "reklamacni-rad",
  title: "Reklamační řád",
  version: "2026-10-15",
  summary:
    "Za co odpovídáme, co je a co není vada, jak reklamaci uplatnit a jak ji vyřídíme.",
  pdf: true,
  sections: [
    {
      id: "uvod",
      title: "1. Úvodem",
      blocks: [
        {
          type: "p",
          text: "Tento reklamační řád popisuje, jak uplatnit práva z vadného plnění u zboží koupeného v obchodě {{seller.web}} a jak reklamaci vyřídíme. Doplňuje [obchodní podmínky](/smluvni-podminky#prava-z-vadneho-plneni) a vychází z občanského zákoníku (dále „OZ“, zejména § 2161 až 2174) a zákona o ochraně spotřebitele (dále „ZOS“, zejména § 19).",
        },
        {
          type: "p",
          text: "Prodávající: {{seller.name}}, se sídlem {{seller.address}}, IČO {{seller.ico}}, e-mail {{seller.email}}, telefon {{seller.phone}}.",
        },
        {
          type: "p",
          text: "Pravidla níže platí pro kupující, kteří jsou spotřebiteli. Kupující podnikatel najde svá pravidla v [čl. 10](/reklamacni-rad#podnikatele).",
        },
      ],
    },
    {
      id: "odpovednost",
      title: "2. Za co odpovídáme",
      blocks: [
        {
          type: "p",
          text: "Odpovídáme za to, že zboží při převzetí nemá vady (§ 2161 OZ). Zejména že:",
        },
        {
          type: "ul",
          items: [
            "odpovídá popisu, druhu, množství, jakosti a dalším vlastnostem, které jsme ujednali nebo které jsme u výrobku uvedli, i v reklamě,",
            "hodí se k účelu, ke kterému jsme ho nabízeli nebo ke kterému se zboží tohoto druhu obvykle používá, a k účelu, který jste nám sdělili a se kterým jsme souhlasili,",
            "je dodáno s příslušenstvím a pokyny k užívání, pokud k němu patří,",
            "u zboží na zakázku odpovídá vašemu zadání a podobě, kterou jste schválili na fotografii před konečným výpalem (ujednaná vlastnost, § 2161 odst. 1 písm. a) OZ).",
          ],
        },
        {
          type: "p",
          text: "Za vadu zboží při převzetí odpovídáme i tehdy, když vznikla při přepravě k vám — nebezpečí škody přechází na vás až převzetím zásilky ([čl. 5](/reklamacni-rad#poskozeni-pri-preprave)).",
        },
      ],
    },
    {
      id: "co-neni-vadou",
      title: "3. Co není vadou",
      blocks: [
        {
          type: "p",
          text: "Každý kus vzniká ručně a prochází dvěma výpaly, takže žádné dva nejsou stejné. Vadou proto nejsou:",
        },
        {
          type: "ul",
          items: [
            "drobné rozdíly v odstínu a kresbě glazury, ve struktuře povrchu a v tvaru proti fotografii,",
            "rozměr v toleranci uvedené u výrobku (například „tolerance –3 cm“); u zboží na zakázku drobná odchylka rozměru daná ruční výrobou,",
            "opotřebení způsobené obvyklým užíváním,",
            "poškození, které vzniklo po převzetí nesprávným zacházením nebo užíváním v rozporu s pokyny — například prasklina pítka nebo jiné nádoby na vodu, ve které v zimě zamrzla voda, pokud jsme vás na nebezpečí mrazu upozornili u výrobku a na kartičce přiložené k zásilce,",
            "vada, pro kterou jsme kus prodali za nižší cenu (kolekce „Poškozené“ — vada je popsaná a vyfocená u výrobku, § 2167 OZ); za jiné vady takového kusu odpovídáme.",
          ],
        },
        {
          type: "p",
          text: "U zboží na zakázku není vadou ani to, že se vám schválená podoba nakonec nelíbí. Vadou je prasklina, odštěpek, odlupující se glazura, jiný motiv, text nebo rozměr než ve schválené podobě a poškození při přepravě; nesoulad se zadáním (jiné číslo, jméno, motiv) je vadou vždy. Podrobně [obchodní podmínky, čl. IX](/smluvni-podminky#vyroba-na-zakazku).",
        },
      ],
    },
    {
      id: "lhuty",
      title: "4. Do kdy můžete reklamovat",
      blocks: [
        {
          type: "p",
          text: "Vadu, která se projeví **do 2 let od převzetí zboží**, můžete reklamovat (§ 2165 OZ). Platí to i pro zboží na zakázku a pro kusy s vadou — u nich pro jiné vady, než pro kterou byly levnější.",
        },
        {
          type: "p",
          text: "Projeví-li se vada **do 1 roku od převzetí**, má se za to, že zboží bylo vadné už při převzetí (§ 2161 odst. 5 OZ). Nemusíte tedy dokazovat, že vada tu byla od začátku; opak by musel prokázat prodávající. Neplatí to, vylučuje-li to povaha zboží nebo vady.",
        },
      ],
    },
    {
      id: "poskozeni-pri-preprave",
      title: "5. Poškození při přepravě",
      blocks: [
        {
          type: "p",
          text: "Dorazí-li zboží rozbité nebo poškozené, je to vada při převzetí a reklamujete ji **u nás**, ne u dopravce. Napište nám co nejdřív, nejlépe s fotografiemi obalu i obsahu a s číslem objednávky. Škodu s Českou poštou vyřizujeme my; žádná lhůta dopravce se na vás nevztahuje.",
        },
        {
          type: "p",
          text: "Prosíme, prohlédněte si zásilku při převzetí. Je-li obal zjevně poškozený, můžete ji nepřevzít, nebo ji rozbalit před doručovatelem a poškození s ním zapsat. Je to prosba, která nám pomůže při jednání s dopravcem — **ne podmínka** vašich práv. Obal s výplní si prosím nechte, než se domluvíme.",
        },
      ],
    },
    {
      id: "uplatneni",
      title: "6. Jak reklamaci uplatnit",
      blocks: [
        { type: "p", text: "Reklamaci můžete uplatnit kterýmkoli z těchto způsobů:" },
        {
          type: "ul",
          items: [
            "**online** u objednávky — v zákaznickém účtu (v části Objednávky) nebo přes odkaz na objednávku z e-mailu,",
            "**e-mailem** na {{seller.email}},",
            "**dopisem** na {{seller.name}}, {{seller.address}},",
            "**osobně** v ateliéru na téže adrese, po předchozí domluvě.",
          ],
        },
        {
          type: "p",
          text: "Uveďte prosím číslo objednávky, popis vady, kdy jste si jí všimli, a jaký způsob vyřízení požadujete. Fotografie vady (a u poškození při přepravě i obalu) vyřízení výrazně urychlí. Můžete použít [reklamační protokol](/reklamacni-protokol#formular), není to ale povinné.",
        },
        {
          type: "p",
          text: "**Reklamace je uplatněna okamžikem, kdy nám ji oznámíte** — odesláním e-mailu, online formuláře nebo dopisu, případně osobně. Od té chvíle běží lhůta pro vyřízení; nezáleží na tom, kdy k nám dorazí samotné zboží.",
        },
        {
          type: "p",
          text: "Zboží nám posílejte, až se domluvíme, jestli je to potřeba — často stačí fotografie. Posíláte-li ho, zabalte ho prosím pečlivě a přiložte číslo objednávky.",
        },
      ],
    },
    {
      id: "prava",
      title: "7. Jaká máte práva",
      blocks: [
        {
          type: "p",
          text: "Má-li zboží vadu, máte tato práva (§ 2169 až 2171 OZ):",
        },
        {
          type: "ol",
          items: [
            "**Oprava, nebo výměna.** Můžete zvolit, zda chcete vadu opravit, nebo dodat nový kus bez vady. Zvolený způsob můžeme odmítnout, je-li nemožný nebo ve srovnání s druhým nepřiměřeně nákladný. U unikátních ručně dělaných kusů výměna často možná není.",
            "**Přiměřená sleva, nebo odstoupení od smlouvy.** Máte na ně právo, když opravu ani výměnu nelze provést nebo jsme je odmítli, když jsme vadu neodstranili v přiměřené lhůtě, když se vada projeví opakovaně, když je vada podstatným porušením smlouvy, nebo když je z našeho prohlášení či z okolností zřejmé, že vadu neodstraníme v přiměřené době nebo bez značných obtíží pro vás.",
            "**Nevýznamná vada.** Je-li vada nevýznamná, od smlouvy odstoupit nelze; přiměřenou slevu požadovat můžete.",
          ],
        },
        {
          type: "p",
          text: "Odstoupíte-li od smlouvy pro vadu, vrátíme vám kupní cenu včetně nákladů na dodání stejným způsobem, jakým jste platili, nedohodneme-li se jinak.",
        },
      ],
    },
    {
      id: "vyrizeni",
      title: "8. Potvrzení a vyřízení reklamace",
      blocks: [
        {
          type: "p",
          text: "Přijetí reklamace vám bez zbytečného odkladu **potvrdíme e-mailem** — s datem, kdy jste ji uplatnili, jejím obsahem a způsobem vyřízení, který požadujete (§ 19 odst. 1 ZOS).",
        },
        {
          type: "p",
          text: "Reklamaci vyřídíme **nejpozději do 30 dnů od jejího uplatnění**, včetně odstranění vady, nedohodneme-li se s vámi na delší lhůtě. Pokud lhůtu nedodržíme, můžete od smlouvy odstoupit, nebo požadovat přiměřenou slevu.",
        },
        {
          type: "p",
          text: "Po vyřízení vám pošleme potvrzení s datem a způsobem vyřízení, u opravy i s dobou jejího trvání, případně se zdůvodněním, proč jsme reklamaci zamítli.",
        },
      ],
    },
    {
      id: "naklady",
      title: "9. Náklady reklamace",
      blocks: [
        {
          type: "p",
          text: "Oprávněná reklamace vás nic nestojí. Uhradíme vám účelně vynaložené náklady, zejména poštovné za zaslání zboží k nám — pošlete nám prosím doklad o jeho ceně. Opravené nebo nové zboží vám pošleme na naše náklady.",
        },
      ],
    },
    {
      id: "podnikatele",
      title: "10. Kupující podnikatel",
      blocks: [
        {
          type: "p",
          text: "Nakupuje-li podnikatel pro své podnikání, řídí se jeho práva z vadného plnění § 2099 až 2117 OZ. Vadu musí oznámit bez zbytečného odkladu poté, co ji mohl při včasné prohlídce a dostatečné péči zjistit. Ustanovení tohoto řádu, která chrání spotřebitele (zejména domněnka v čl. 4 a lhůta 30 dnů v čl. 8), se na něj nevztahují; reklamaci ale vyřídíme stejně pečlivě.",
        },
      ],
    },
    {
      id: "spory",
      title: "11. Když s vyřízením nesouhlasíte",
      blocks: [
        {
          type: "p",
          text: "Napište nám na {{seller.email}} — zkusíme to vyřešit znovu. Jste-li spotřebitel a nedomluvíme-li se, můžete podat návrh na mimosoudní řešení sporu u **České obchodní inspekce**, Štěpánská 796/44, 110 00 Praha 1, [adr.coi.cz](https://adr.coi.cz), nejpozději do 1 roku ode dne, kdy jste u nás reklamaci poprvé uplatnili. Podrobnosti jsou v [obchodních podmínkách](/smluvni-podminky#reseni-sporu).",
        },
      ],
    },
    {
      id: "zaverecna-ustanoveni",
      title: "12. Účinnost",
      blocks: [
        {
          type: "p",
          text: "Tento reklamační řád je účinný od 15. 10. 2026. Reklamace se řídí zněním platným v den uzavření smlouvy, nestanoví-li zákon jinak.",
        },
      ],
    },
  ],
}

export default reklamacniRad
