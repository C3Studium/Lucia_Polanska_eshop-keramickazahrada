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

/* ------------------------------------------- odpovědi přišpendlené kódem -- */

/**
 * Otázky z horního seznamu (CMS), jejichž ODPOVĚĎ vždy dává kód.
 *
 * Horní seznam na stránce Dotazy je redakční: otázky jsou dokumenty `qna`
 * ve Studiu (záložně blok `dotazy.otazky` nebo seznam ve FAQBody). Dvě z nich
 * ale slibují zákonná práva a staré znění ve Studiu jim odporovalo:
 *
 * - rozbitá zásilka „ozvěte se nám do 48 hodin“ — žádná taková lhůta
 *   neplatí, rozbitý kus je vada při převzetí (OP čl. VII a XII);
 * - vrácení „nepoužitého“ výrobku — zákon podmínku „nepoužitý“ nezná,
 *   zákazník odpovídá jen za snížení hodnoty (§ 1833 OZ).
 *
 * Aby zákaznický text nikdy nemohl odporovat obchodním podmínkám, odpověď
 * na tato témata se z CMS nebere: otázka (její znění, kategorie, pořadí)
 * zůstane, jak ji redakce napsala, odpověď se nahradí touhle. Mění se spolu
 * s OP v PR, ne ve Studiu.
 *
 * Proč VŽDY, a ne jen dokud text ze Studia obsahuje to staré špatné tvrzení
 * (zkoušeno 15. 10. 2026 a vráceno): seznam „zakázaných" formulací zachytí
 * jen chyby, které už někdo viděl. „Vrátit do 7 dnů", „zakázkové kusy vrátit
 * nelze" bez dovětku o reklamaci vady nebo „nahlaste hned u doručovatele,
 * jinak reklamaci neuznáme" by jím prošly — a na webu by stál slib, který
 * zákonu odporuje. Zákonné odpovědi proto drží jen kód.
 *
 * ## Jak se otázka z CMS pozná
 *
 * Dokument `qna` nenese žádný stálý klíč (mimo náhled je i `id` null), takže
 * se páruje znění otázky, normalizované (malá písmena, bez diakritiky
 * a interpunkce):
 *
 * 1. `id` — jen záložní seznam ve FAQBody, ten ho má pevné;
 * 2. `questions` — známá znění otázky (dnes je kód i Studio píšou stejně);
 * 3. `topic` — záchranná síť pro přeformulovanou otázku: normalizované
 *    znění musí obsahovat každý vzor z `all` a žádný z `none`. Vzory jsou
 *    schválně úzké — falešná shoda by jen nahradila odpověď správnou právní,
 *    ale nemá se trefovat do otázek o poukazech, zakázkách či kurzech, na
 *    které odpovídá pevná sekce `LEGAL_FAQ` níž.
 *
 * Nové téma sem patří, kdykoli redakční odpověď začne slibovat (nebo upírat)
 * zákonné právo. Odpovědi jsou prostý text — horní seznam značku nevykresluje.
 */
export type PinnedFaqAnswer = {
  /** Stejné `id` jako otázka v záložním seznamu FAQBody. */
  id: string
  /** Známá znění otázky — porovnávají se normalizovaně (`normalizeFaqQuestion`). */
  questions: string[]
  /** Vzory nad normalizovaným zněním: musí sedět všechny z `all` a žádný z `none`. */
  topic: { all: RegExp[]; none?: RegExp[] }
  answer: string
}

/** Poukazy, zakázky a kurzy mají vlastní odpovědi v `LEGAL_FAQ` — obecné vrácení na ně nesedí. */
const NOT_GENERAL_GOODS = [/poukaz/, /zakazk/, /kurz/]

export const PINNED_FAQ_ANSWERS: PinnedFaqAnswer[] = [
  {
    id: "poskozena-zasilka",
    questions: ["Jak postupovat, když zásilka dorazí poškozená?"],
    topic: {
      all: [/poskozen|rozbit|praskl/, /zasilk|balik|doruc|preprav|dorazi/],
    },
    /* Žádná krátká lhůta: rozbitý kus je vada při převzetí a reklamuje se
       u nás (obchodní podmínky čl. VII a XII). Dřívějších „48 hodin" a
       dvoudenní lhůtu dopravce zákazník dodržet nemusí. */
    answer:
      "Vyfoťte prosím balík i poškozený kus a ozvěte se nám s číslem objednávky — čím dřív, tím líp, ale žádná krátká lhůta pro vás neplatí. Domluvíme se na výměně nebo opravě, a když to nejde, vrátíme peníze. U České pošty nic reklamovat nemusíte, to vyřídíme my.",
  },
  {
    id: "vraceni",
    questions: ["Mohu produkt vrátit nebo vyměnit?"],
    topic: {
      all: [/vratit|vraceni|vymenit|vymena|odstoupit/, /produkt|vyrob|zbozi|kus|objednav|nakup/],
      none: NOT_GENERAL_GOODS,
    },
    /* Bez „nepoužitý": § 1829 OZ podmínku nezná, zákazník jen odpovídá za
       snížení hodnoty (§ 1833 OZ, OP čl. VIII). */
    answer:
      "Výrobek z běžné nabídky můžete vrátit bez udání důvodu do 14 dnů od převzetí. Zakázkové kusy dělané přímo podle vašeho zadání vrátit nejde — pokud ovšem mají vadu, reklamujete je jako každé jiné zboží.",
  },
]

/** Malá písmena, bez diakritiky a interpunkce, jednoduché mezery. */
export function normalizeFaqQuestion(text: string): string {
  return text
    .toLocaleLowerCase("cs")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Odpověď z kódu pro otázku z horního seznamu, nebo `null`, když otázka
 * přišpendlená není (pak platí odpověď z CMS). Pravidla párování viz výš.
 */
export function pinnedFaqAnswer(question: { id?: string | null; question: string }): string | null {
  const normalized = normalizeFaqQuestion(question.question)

  const pinned = PINNED_FAQ_ANSWERS.find(
    (item) =>
      (question.id != null && question.id === item.id) ||
      item.questions.some((known) => normalizeFaqQuestion(known) === normalized) ||
      (item.topic.all.every((re) => re.test(normalized)) &&
        !(item.topic.none ?? []).some((re) => re.test(normalized)))
  )

  return pinned?.answer ?? null
}

/* ------------------------------------------------ pevná právní sekce -- */

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
          "Zadání vám potvrdím. V den, kdy začnu vyrábět, vám přijde e-mail „Zakázka je ve výrobě“ — od něj běží výrobní lhůta uvedená u výrobku. Před konečným výpalem vám pošlu fotku ke schválení (máte 5 pracovních dnů). Až bude hotovo, doplatíte zbytek ceny a zakázku do 2 pracovních dnů pošlu nebo předám. Shrnutí smlouvy dostanete jako PDF „Potvrzení zakázky“ spolu s potvrzením objednávky.",
        ],
      },
      {
        id: "faq-zakazka-zaloha",
        question: "Kolik se u zakázky platí předem?",
        answer: [
          "Při objednávce zaplatíte zálohu {{mto.deposit}} ceny, nejvýš polovinu. Platí se předem online — i když si zakázku vyzvednete osobně. Zbytek a dopravu doplatíte, až je hotovo.",
          "Zrušíte-li zakázku dřív, než vám přijde e-mail „Zakázka je ve výrobě“, vrátím vám všechno. Po něm se záloha nevrací — pokrývá materiál, návrh a práci, které už jsou v kusu, který nikomu jinému neprodám; všechno zaplacené nad zálohu vrátím do 14 dnů. [Podrobnosti v obchodních podmínkách](/smluvni-podminky#vyroba-na-zakazku).",
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
          "„Nelíbí se mi to“ vada není — proto podobu schvalujete na fotce ještě před výpalem. Vadou je prasklina, odštěpek, odlupující se glazura, jiný motiv, text nebo rozměr než ve schválené podobě, nebo poškození při přepravě; jiné číslo či text, než jste zadali, je vadou vždy. Reklamovat ji můžete 2 roky jako každé jiné zboží.",
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
          "Uplatnění: kód poukazu zadejte v košíku nebo v pokladně do pole „Slevový kód nebo dárkový poukaz“ — částka se odečte hned (ze zboží, které není ve slevě; poštovné doplatíte). V ateliéru ho stačí předložit. Platí na keramiku z obchodu i na zakázky, na kurzy zatím ne. Zbytek hodnoty zůstává na poukazu do konce platnosti a zůstatek vám kdykoli řeknu. Poukaz vám pošlu vytištěný poštou, nebo elektronicky e-mailem — klidně rovnou obdarovanému.",
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
    id: "faq-bezpecnost",
    title: "Nezávadnost a bezpečnost",
    items: [
      {
        id: "faq-bezpecnost-potraviny",
        question: "Je keramika zdravotně nezávadná a vhodná pro styk s potravinami?",
        answer: [
          "Glazury, u kterých to u výrobku uvádím, mám ověřené protokolem o nezávadnosti (limity pro olovo a kadmium podle nařízení (ES) č. 1935/2004 a vyhlášky č. 38/2001 Sb.). Protokoly najdete na stránce [Certifikáty](/certifikaty) — u každého je datum a název glazury, které se týká.",
          "Výrobek, u kterého nezávadnost uvedená není (dekorace, výrobky z kurzů), pro jídlo a pití nepoužívejte.",
        ],
      },
      {
        id: "faq-bezpecnost-montaz",
        question: "Jak bezpečně zavěsit plastiku nebo domovní číslo na fasádu?",
        answer: [
          "Keramika je těžká a křehká. Kotvěte ji do nosného podkladu hmoždinkami a vruty odpovídajícími zdivu a hmotnosti kusu a nezavěšujte ji nad místa, kde by pád mohl někoho zranit. Rozbitý kus má ostré hrany — střepy ukliďte opatrně a mimo dosah dětí.",
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
