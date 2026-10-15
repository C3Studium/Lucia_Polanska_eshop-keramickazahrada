import type { LegalDocumentVersion } from "../../types"

/**
 * Doprava a platba — znění od 15. 10. 2026.
 *
 * Ceny v textu NEJSOU: kapitola `cenik` dostane na stránce tabulku
 * `modules/legal/ShippingPrices`, která je načítá z backendu
 * (`GET /store/legal/shipping-prices`) — stejné jako v pokladně. Dřívější
 * dvě sady cen pro ČR, „varianta 2" a PlatímPak (Equa Bank zanikla 2022)
 * jsou pryč (LEGAL_AUDIT.md §6).
 *
 * Způsoby platby odpovídají pokladně (ověřeno v kódu 14. 10. 2026):
 * ComGate — karta, Apple/Google Pay, online převod přes banku (splátky ani
 * odložené platby selektor záměrně nenabízí); dobírka jen ČR + Česká pošta
 * na adresu, ne zakázka; „Zaplatíte při vyzvednutí" jen u osobního odběru
 * (hotově — backend modules/pickupPayment); záloha zakázky jen předem
 * online. Bankovní převod s QR není způsob platby v pokladně.
 */
const dopravaAPlatba: LegalDocumentVersion = {
  slug: "doprava-a-platba",
  title: "Doprava a platba",
  version: "2026-10-15",
  summary:
    "Čím posíláme, kolik to stojí, jak dlouho to trvá a jak můžete zaplatit — pro Česko i Slovensko.",
  pdf: false,
  sections: [
    {
      id: "zpusoby-doruceni",
      title: "Čím posíláme",
      blocks: [
        {
          type: "p",
          text: "Posíláme po **České republice** a na **Slovensko**, a to **Českou poštou**:",
        },
        {
          type: "ul",
          items: [
            "**Balíkovna** — doručení na výdejní místo nebo do boxu Balíkovny, které si vyberete v pokladně,",
            "**Česká pošta – na adresu** — doručení domů nebo do práce,",
            "**Česká pošta – křehké** — křehký balík na adresu; jen tak posíláme křehké kusy a zakázky.",
          ],
        },
        {
          type: "p",
          text: "Zboží si také můžete vyzvednout **osobně v ateliéru** na adrese {{seller.address}}.",
        },
        {
          type: "p",
          text: "Které možnosti máte k dispozici, záleží na zboží v košíku a na zemi doručení. V pokladně vždy uvidíte jen ty, které pro vaši objednávku jdou.",
        },
      ],
    },
    {
      id: "cenik",
      title: "Ceny dopravy",
      blocks: [
        {
          type: "p",
          text: "Ceník níže se načítá přímo z obchodu, takže platí totéž co v pokladně. Ceny jsou konečné. Přesnou cenu pro vaši objednávku uvidíte v pokladně po zadání adresy, ještě než objednávku odešlete.",
        },
      ],
    },
    {
      id: "balne",
      title: "Balné",
      blocks: [
        {
          type: "p",
          text: "Keramiku balíme do několika vrstev a pevné krabice. Ke každému výrobku se proto připočítává balné — jeho výši vidíte v košíku přímo pod výrobkem. Balné se účtuje i při osobním odběru.",
        },
      ],
    },
    {
      id: "krehke-zbozi",
      title: "Křehké kusy a zakázky",
      blocks: [
        {
          type: "p",
          text: "Je-li v košíku křehký kus nebo zboží vyrobené na zakázku, nabídneme jen křehký balík Českou poštou na adresu, nebo osobní odběr. Je to proto, aby kus dorazil celý.",
        },
      ],
    },
    {
      id: "dorucovaci-doba",
      title: "Kdy zboží dorazí",
      blocks: [
        {
          type: "p",
          text: "Co máme skladem, předáváme dopravci zpravidla do 2 pracovních dnů od přijetí platby (u dobírky od objednávky). Doručení pak obvykle trvá 1 až 3 pracovní dny.",
        },
        {
          type: "p",
          text: "Výrobky dělané na objednávku a zakázky mají vlastní lhůtu, kterou najdete u výrobku nebo v nabídce — každý kus vzniká ručně a prochází dvěma výpaly.",
        },
        {
          type: "p",
          text: "Jakmile zásilku odešleme, přijde vám e-mail.",
        },
      ],
    },
    {
      id: "osobni-odber",
      title: "Osobní odběr",
      blocks: [
        {
          type: "p",
          text: "Zboží si můžete vyzvednout v ateliéru na adrese {{seller.address}}. Až bude připravené, ozveme se a domluvíme čas. Zaplatit můžete předem online, nebo v hotovosti při vyzvednutí; zálohu na zakázku platíte vždy předem online.",
        },
      ],
    },
    {
      id: "slovensko",
      title: "Doprava na Slovensko",
      blocks: [
        {
          type: "p",
          text: "Na Slovensko prodáváme v eurech. Přepněte si obchod na Slovensko (měnu EUR) a v pokladně zvolte zemi doručení Slovensko.",
        },
        {
          type: "p",
          text: "Ceny v eurech odvozujeme od cen v korunách podle kurzu České národní banky; závazná je cena v eurech, kterou vidíte v košíku při objednávce. Cenu dopravy na Slovensko najdete v ceníku výše a přesně pak v pokladně po zadání adresy. Dobírku na Slovensko nenabízíme.",
        },
      ],
    },
    {
      id: "zpusoby-platby",
      title: "Jak můžete zaplatit",
      blocks: [
        {
          type: "ul",
          items: [
            "**Platební kartou** online — Visa, Mastercard a další karty, přes platební bránu ComGate.",
            "**Apple Pay nebo Google Pay** — rychlá platba kartou uloženou v telefonu nebo v prohlížeči (Apple Pay jen na zařízení Apple).",
            "**Online převodem přes banku** — brána ComGate vás přesměruje do vašeho internetového bankovnictví s připraveným platebním příkazem. Platba je potvrzená hned a objednávku vyřizujeme bez čekání.",
            "**Na dobírku** — viz níže.",
            "**V hotovosti při osobním odběru** v ateliéru.",
          ],
        },
        {
          type: "p",
          text: "Splátky ani odloženou platbu nenabízíme. Zálohu na zakázku platíte vždy předem online — kartou, peněženkou, nebo převodem přes bránu.",
        },
      ],
    },
    {
      id: "dobirka",
      title: "Dobírka",
      blocks: [
        {
          type: "p",
          text: "Na dobírku můžete zaplatit, když posíláme Českou poštou na adresu v České republice. Peníze vybere doručovatel při předání zásilky. K ceně se připočítává doběrečné — jeho aktuální výši vidíte v ceníku výše i u volby platby v pokladně.",
        },
        {
          type: "p",
          text: "Dobírku nenabízíme na výdejní místa a do boxů Balíkovny, na Slovensko, u zboží na zakázku a u několika dalších výrobků — v pokladně se pak tato možnost nezobrazí.",
        },
      ],
    },
    {
      id: "comgate",
      title: "Platební brána ComGate",
      blocks: [
        {
          type: "p",
          text: "Online platby pro nás zajišťuje ComGate Payments, a.s., licencovaná platební instituce pod dohledem České národní banky. Údaje o kartě zadáváte až v zabezpečeném rozhraní brány — my je nevidíme ani neukládáme. Platby kartou chrání standard 3-D Secure, banka vás proto může požádat o potvrzení v aplikaci nebo kódem z SMS.",
        },
        {
          type: "ul",
          items: [
            "ComGate Payments, a.s., Gočárova třída 1754/48b, Hradec Králové",
            "e-mail: platby-podpora@comgate.cz",
            "telefon: +420 228 224 267",
          ],
        },
      ],
    },
    {
      id: "neuspesna-platba",
      title: "Když platba neprojde",
      blocks: [
        {
          type: "p",
          text: "Stává se to. Když platba v bráně neprojde (zrušíte ji, banka ji zamítne nebo vyprší čas), pošleme vám e-mail s odkazem, kterým se k platbě vrátíte. Nepomůže-li to, napište nebo zavolejte a vyřešíme to spolu.",
        },
        {
          type: "p",
          text: "Po dohodě můžete zaplatit i převodem na náš účet {{bank.account}}. Jako variabilní symbol uveďte číslo objednávky.",
        },
      ],
    },
    {
      id: "doklad",
      title: "Doklad o zaplacení",
      blocks: [
        {
          type: "p",
          text: "Doklad o zaplacení (fakturu) vám pošleme e-mailem. U zakázky dostanete zvlášť doklad za zálohu a za doplatek.",
        },
        {
          type: "p",
          text: "Podrobná pravidla dopravy a plateb jsou v [obchodních podmínkách](/smluvni-podminky#cena-a-platba).",
        },
      ],
    },
  ],
}

export default dopravaAPlatba
