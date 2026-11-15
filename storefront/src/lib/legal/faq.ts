/**
 * Právní otázky ke stránce Dotazy — VÝCHOZÍ obsah, ne pravda.
 *
 * Od 15. 11. 2026 žijí ve Studiu jako běžné otázky (`qna`) s kategoriemi
 * podle názvu skupiny (Zakázková výroba, Kurzy, …) a Lucie je tam opravuje.
 * Tenhle seznam slouží jen:
 *
 * - `scripts/seed-faq.mjs` z něj otázky a kategorie do Studia založí
 *   (jednou; co už ve Studiu je, nepřepíše);
 * - stránka Dotazy ho ukáže, když ve Studiu není žádná otázka (výpadek CMS).
 *
 * Řetězce používají stejnou značku jako právní dokumenty (`./types.ts`):
 * `**tučně**`, `[odkaz](/cesta#kotva)`, `{{fakt}}`. Stejně se vykreslují
 * i odpovědi ze Studia (FAQ/index.tsx, `renderInline`).
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

/* ------------------------------------------------------ výchozí otázky -- */

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
          "Při objednávce zaplatíte zálohu ve výši uvedené u výrobku — podle kusu 25 až 50 % ceny. Platí se předem online — i když si zakázku vyzvednete osobně. Zbytek a dopravu doplatíte, až je hotovo.",
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
          "Ano. Rezervaci za dítě dělá rodič nebo jiný zákonný zástupce. Věk: {{course.minAge}}.",
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

/** Odpověď jako jeden text pro Studio — odstavce oddělené prázdným řádkem. */
export const legalFaqAnswerText = (item: LegalFaqItem): string => item.answer.join("\n\n")
