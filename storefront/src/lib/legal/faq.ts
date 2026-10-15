/**
 * Právní otázky na stránce Dotazy — pevná sekce pod otázkami z CMS.
 *
 * Proč v kódu a ne v CMS: odpovědi slibují konkrétní práva (žádné
 * 14denní odstoupení u zakázky a kurzu, žádná lhůta dopravce u rozbité
 * zásilky) a musí se shodovat s obchodními podmínkami. Text se mění spolu
 * s OP v PR, ne nezávisle v redakci.
 *
 * Řetězce používají stejnou značku jako právní dokumenty (`./types.ts`):
 * `**tučně**`, `[odkaz](/cesta#kotva)`, `{{fakt}}`, `[[DOPLNIT: …]]`.
 * Vykresluje je `renderInline` z `./inline.tsx`.
 */

export type LegalFaqItem = {
  /** Kotva v URL (`/dotazy#id`) — po vydání neměnit. */
  id: string
  question: string
  /** Odstavce odpovědi. */
  answer: string[]
}

export type LegalFaqGroup = {
  id: string
  title: string
  items: LegalFaqItem[]
}

export const LEGAL_FAQ: LegalFaqGroup[] = [
  {
    id: "faq-zakazka",
    title: "Zakázková výroba",
    items: [
      {
        id: "faq-zakazka-postup",
        question: "Jak probíhá objednávka zakázky?",
        answer: [
          "Zakázkový výrobek objednáte v obchodě a v pokladně popíšete, co si přejete — text, číslo, motiv, případně přiložíte fotky. Nemáte vybraný konkrétní výrobek? Napište mi přes formulář na stránce [Výroba](/vyroba).",
          "Zadání vám potvrdím a pustím se do práce. Před konečným výpalem vám pošlu fotku ke schválení. Až bude hotovo, doplatíte zbytek ceny a zakázku pošlu nebo předám.",
        ],
      },
      {
        id: "faq-zakazka-zaloha",
        question: "Kolik se u zakázky platí předem?",
        answer: [
          "Při objednávce zaplatíte zálohu {{mto.deposit}} ceny, nejvýš polovinu. Platí se předem online — i když si zakázku vyzvednete osobně. Zbytek a dopravu doplatíte, až je hotovo.",
          "Zrušíte-li zakázku dřív, než začnu vyrábět, vrátím zálohu celou. Potom si ponechám jen to, co jsem do té doby skutečně vynaložila (materiál, práce, výpal). [Podrobnosti v obchodních podmínkách](/smluvni-podminky#vyroba-na-zakazku).",
        ],
      },
      {
        id: "faq-zakazka-vraceni",
        question: "Můžu zakázku vrátit do 14 dnů?",
        answer: [
          "Ne. Kus vyrobený podle vašeho zadání (číslo domu, jméno, konkrétní motiv, rozměr na míru) už nikomu jinému neprodám, a proto zákon u takového zboží 14denní odstoupení vylučuje (§ 1837 písm. d) občanského zákoníku). Upozorním vás na to předem a vy to před objednáním potvrdíte.",
          "Pokud jste jen vybrali barvu nebo velikost z nabídky, o zakázku nejde a vrátit to můžete jako jiné zboží.",
        ],
      },
      {
        id: "faq-zakazka-vada",
        question: "Co když má zakázka vadu?",
        answer: [
          "„Nelíbí se mi to“ vada není — proto podobu schvalujete na fotce ještě před výpalem. Vadou je rozpor se schváleným návrhem (jiný motiv nebo text, rozměr větší či menší o víc než 5 %) nebo poškození. Reklamovat ji můžete 2 roky jako každé jiné zboží.",
          "Drobné odchylky v odstínu glazury a struktuře povrchu patří k ruční výrobě a vadou nejsou.",
        ],
      },
    ],
  },
  {
    id: "faq-kurzy",
    title: "Kurzy",
    items: [
      {
        id: "faq-kurzy-storno",
        question: "Co když na kurz nemůžu přijít?",
        answer: [
          "Dejte mi co nejdřív vědět e-mailem nebo telefonem. Platí tyto storno podmínky: {{course.cancellation}}",
          "Když kurz zruším já, vrátím vám celou částku, nebo si vyberete náhradní termín. [Celé podmínky kurzů](/smluvni-podminky#kurzy).",
        ],
      },
      {
        id: "faq-kurzy-odstoupeni",
        question: "Proč u kurzu nejde odstoupit do 14 dnů?",
        answer: [
          "Kurz má pevný termín a místo, které držím jen pro vás, už nikomu jinému nenabídnu. Zákon proto u služeb volného času s pevným termínem 14denní odstoupení vylučuje (§ 1837 písm. j) občanského zákoníku). Místo něj platí storno podmínky výše.",
        ],
      },
      {
        id: "faq-kurzy-deti",
        question: "Můžou na kurz děti?",
        answer: [
          "Ano. Rezervaci za dítě dělá rodič nebo jiný zákonný zástupce. Minimální věk: {{course.minAge}}.",
          "Během vedené práce se o děti postarám, mimo ni (příchod, přestávky, odchod) za ně odpovídá rodič. Fotky dětí zveřejním jen se souhlasem rodiče.",
        ],
      },
      {
        id: "faq-kurzy-vyrobek",
        question: "Kdy si odnesu výrobek z kurzu?",
        answer: [
          "Výrobky musí doschnout a projít výpalem, takže si je vyzvednete později v ateliéru — do {{course.pickupDeadline}}.",
          "Hlína je živý materiál a při výpalu občas praskne. Když se to stane, ozvu se a domluvíme se, co dál.",
        ],
      },
    ],
  },
  {
    id: "faq-poukazy",
    title: "Dárkové poukazy",
    items: [
      {
        id: "faq-poukazy-platnost",
        question: "Jak dlouho platí dárkový poukaz a jak ho uplatním?",
        answer: [
          "Platnost: {{voucher.validity}} od nákupu; datum konce platnosti najdete na poukazu. Poukaz nejde vyměnit za peníze.",
          "Uplatnění: [[DOPLNIT: jak se poukaz uplatňuje]]",
        ],
      },
      {
        id: "faq-poukazy-vraceni",
        question: "Můžu poukaz vrátit?",
        answer: [
          "Ano, do 14 dnů od chvíle, kdy jste ho dostali — dokud ho nikdo neuplatnil, ani zčásti. Po uplatnění už vrátit nejde. [Podmínky poukazů](/smluvni-podminky#darkove-poukazy).",
        ],
      },
    ],
  },
  {
    id: "faq-zasilky",
    title: "Poškozená zásilka",
    items: [
      {
        id: "faq-poskozena-zasilka",
        question: "Zásilka dorazila rozbitá. Musím to do 2 dnů reklamovat u České pošty?",
        answer: [
          "Nemusíte. Napište nám — nejlépe s fotkou obalu i rozbitého kusu a s číslem objednávky — a domluvíme se na výměně nebo opravě, a když to nejde, vrátíme peníze. Škodu s Českou poštou si vyřešíme sami.",
          "Kontrola zásilky při převzetí pomůže, ale není podmínkou. Rozbitý kus nám můžete nahlásit i později; čím dřív, tím líp. [Jak reklamovat](/reklamacni-protokol#poskozeni-pri-preprave).",
        ],
      },
    ],
  },
]
