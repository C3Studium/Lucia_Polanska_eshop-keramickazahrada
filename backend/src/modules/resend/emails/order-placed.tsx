import { Column, Img, Link, Row, Section, Text } from "@react-email/components"
import { BigNumberValue, CustomerDTO, OrderDTO } from "@medusajs/framework/types"
import type { OrderLegalDocument, OrderLegalEmailData } from "../../../lib/legal/order-legal"
import { orderLink } from "../../../lib/storefront-url"
import {
  isPackagingLine,
  PACKAGING_TITLE,
  withPackagingUnderProducts,
} from "../../../lib/packaging-lines"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  LedgerEnd,
  LedgerRow,
  MultiLine,
  Note,
  P,
  Signature,
  useUiCopy,
} from "../components/email-ui"
import { useCopy, useEmailLocale, useIntlLocale } from "../components/email-i18n"
import {
  formatEmailDate,
  localizedLineTitle,
  piecesLabel,
  type EmailLocale,
  type Localized,
} from "../../../lib/email-locale"

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění.
 *
 * Právní dokumenty (OP, poučení, reklamační řád) existují jen česky; v PL
 * a DE to sekce „Smlouva a poučení" řekne (SK češtině rozumí). Paragrafy
 * jsou z českého občanského zákoníku — v cizím jazyce se proto jmenuje
 * „český", jinak by si ho Slovák spletl se svým OZ.
 */
type OrderPlacedCopy = {
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: string
  introCommission: string
  introPickup: string
  introShipping: string
  itemsHeading: string
  packaging: string
  codFee: string
  glazeAttached: string
  glaze: string
  summary: string
  subtotal: string
  total: string
  deliveryPayment: string
  delivery: string
  pickupInWorkshop: string
  pickupPoint: string
  address: string
  payment: string
  viewOrder: string
  balanceDue: (amount: string) => string
  balanceText: string
  payBalance: (amount: string) => string
  bannerCta: string
  manage: string
  manageText: string
  editOrder: string
  claimOrReturn: string
  withdrawalOnline: string
  withdrawalLink: string
  withdrawalOnlineAfter: string
  withdrawalPlain: string
  contact: string
  closing: string
  orderNumberNote: string
  legal: {
    eyebrow: string
    confirmations: string
    confirmation: string
    orderConfirmation: string
    termsAttached: string
    withdrawalAttached: string
    and: string
    intro: string
    attachedSentence: (list: string) => string
    termsSentence: (version: string) => string
    /** Jen PL/DE — dokumenty jsou česky. */
    docsNote: string | null
    seller: string
    ico: string
    commissionConfirmation: string
    orderConfirmationTitle: string
    commissionDesc: string
    orderConfirmationDesc: string
    inAttachment: string
    download: string
    viewOnWeb: string
    validFrom: string
    termsLabel: string
    withdrawalLabel: string
    complaintsLabel: string
    allMadeToOrder: string
    withdrawal: (formAttached: boolean) => string
    madeToOrderException: (items: string) => string
  }
}

const COPY: Localized<OrderPlacedCopy> = {
  cs: {
    preview: "Objednávku mám, děkuji. Teď je to na mně.",
    eyebrow: "Objednávka",
    title: "Objednávku mám,",
    accent: "děkuji.",
    intro: "děkuji za vaši objednávku — mám ji u sebe a teď je to na mně.",
    introCommission:
      "Výrobek na zakázku má svůj vlastní běh: jakmile se pustím do výroby, napíšu vám, a znovu až bude kousek hotový.",
    introPickup:
      "Každý kousek prohlédnu a zabalím; až bude objednávka připravená k vyzvednutí u mě v dílně, dám vám vědět.",
    introShipping:
      "Každý kousek prohlédnu a pečlivě zabalím. Zboží skladem předám dopravci do 3 pracovních dnů a pošlu vám číslo zásilky, abyste ji mohli sledovat.",
    itemsHeading: "Co jste si objednali",
    packaging: PACKAGING_TITLE,
    codFee: "Doběrečné",
    glazeAttached: "Zdravotně nezávadná glazura — protokol přikládáme: ",
    glaze: "Zdravotně nezávadná glazura — protokol: ",
    summary: "Souhrn",
    subtotal: "Mezisoučet",
    total: "Celkem",
    deliveryPayment: "Doručení a platba",
    delivery: "Doručení",
    pickupInWorkshop: "Osobní odběr v dílně",
    pickupPoint: "Výdejní místo",
    address: "Doručovací adresa",
    payment: "Platba",
    viewOrder: "Zobrazit objednávku",
    balanceDue: (amount) => `Zbývá doplatit ${amount}.`,
    balanceText:
      "Váš kousek vyrábím na zakázku. Doplatek můžete zaplatit hned, nebo počkat, až vám napíšu, že je hotový — jak je vám milejší.",
    payBalance: (amount) => `Doplatit ${amount}`,
    bannerCta: "Prohlédnout",
    manage: "Správa objednávky",
    manageText:
      "Potřebujete něco změnit, nebo kousek reklamovat či vrátit? Zařídíte to rovnou odsud, bez přihlášení.",
    editOrder: "Upravit objednávku",
    claimOrReturn: "Reklamace nebo vrácení",
    withdrawalOnline:
      "Od smlouvy můžete odstoupit bez udání důvodu do 14 dnů od převzetí (netýká se zboží vyrobeného na zakázku) — online přes",
    withdrawalLink: "Odstoupit od smlouvy",
    withdrawalOnlineAfter: ", nebo e-mailem.",
    withdrawalPlain:
      "Odstoupit od smlouvy můžete do 14 dnů od převzetí (netýká se zboží vyrobeného na zakázku).",
    contact: "Kdyby cokoli, napište mi na info@keramickazahrada.cz — odpovídám sama.",
    closing: "Děkuji a těším se,",
    orderNumberNote: "Číslo objednávky pro případnou komunikaci:",
    legal: {
      eyebrow: "Smlouva a poučení",
      confirmations: "potvrzení zakázek",
      confirmation: "potvrzení zakázky",
      orderConfirmation: "potvrzení objednávky",
      termsAttached: "obchodní podmínky platné pro tuto smlouvu",
      withdrawalAttached: "poučení o odstoupení od smlouvy s formulářem",
      and: " a ",
      intro: "Tímto e-mailem potvrzuji vaši objednávku a uzavření kupní smlouvy.",
      attachedSentence: (list) => ` V příloze posílám ${list} (PDF) — uschovejte si je, prosím.`,
      termsSentence: (version) =>
        ` Smlouva se řídí obchodními podmínkami ve znění platném od ${version}; najdete je na odkazu níže.`,
      docsNote: null,
      seller: "Prodávající",
      ico: "IČO",
      commissionConfirmation: "Potvrzení zakázky",
      orderConfirmationTitle: "Potvrzení objednávky",
      commissionDesc: "· smlouva na výrobek podle vašeho zadání",
      orderConfirmationDesc: "· potvrzení kupní smlouvy (§ 1827 odst. 2 OZ)",
      inAttachment: " — v příloze (PDF)",
      download: "stáhnout PDF",
      viewOnWeb: "zobrazit na webu",
      validFrom: "znění platné od",
      termsLabel: "Obchodní podmínky",
      withdrawalLabel: "Poučení o odstoupení a formulář",
      complaintsLabel: "Reklamační řád",
      allMadeToOrder:
        "Zboží v této objednávce vyrábím podle vašeho zadání, proto od smlouvy nelze odstoupit ve 14denní lhůtě (§ 1837 písm. d) občanského zákoníku). Práva z vadného plnění vám samozřejmě zůstávají — viz reklamační řád.",
      withdrawal: (formAttached) =>
        `Od smlouvy můžete odstoupit bez udání důvodu do 14 dnů od převzetí zboží. Stačí mi to oznámit — e-mailem, dopisem nebo${
          formAttached ? " formulářem z přílohy" : " vzorovým formulářem"
        }, použít ho ale nemusíte. Peníze vám vrátím do 14 dnů od odstoupení stejným způsobem, jakým jste platili; podrobnosti jsou v poučení o odstoupení.`,
      madeToOrderException: (items) =>
        ` Výjimkou je zboží vyrobené podle vašeho zadání (${items}) — u něj odstoupit nelze (§ 1837 písm. d) občanského zákoníku).`,
    },
  },
  sk: {
    preview: "Objednávku mám, ďakujem. Teraz je to na mne.",
    eyebrow: "Objednávka",
    title: "Objednávku mám,",
    accent: "ďakujem.",
    intro: "ďakujem za vašu objednávku — mám ju u seba a teraz je to na mne.",
    introCommission:
      "Výrobok na zákazku má svoj vlastný priebeh: keď sa pustím do výroby, napíšem vám, a znova, keď bude kúsok hotový.",
    introPickup:
      "Každý kúsok prezriem a zabalím; keď bude objednávka pripravená na vyzdvihnutie u mňa v dielni, dám vám vedieť.",
    introShipping:
      "Každý kúsok prezriem a starostlivo zabalím. Tovar skladom odovzdám prepravcovi do 3 pracovných dní a pošlem vám číslo zásielky, aby ste ju mohli sledovať.",
    itemsHeading: "Čo ste si objednali",
    packaging: "Balné",
    codFee: "Poplatok za dobierku",
    glazeAttached: "Zdravotne nezávadná glazúra — protokol prikladáme: ",
    glaze: "Zdravotne nezávadná glazúra — protokol: ",
    summary: "Súhrn",
    subtotal: "Medzisúčet",
    total: "Spolu",
    deliveryPayment: "Doručenie a platba",
    delivery: "Doručenie",
    pickupInWorkshop: "Osobný odber v dielni",
    pickupPoint: "Výdajné miesto",
    address: "Doručovacia adresa",
    payment: "Platba",
    viewOrder: "Zobraziť objednávku",
    balanceDue: (amount) => `Zostáva doplatiť ${amount}.`,
    balanceText:
      "Váš kúsok vyrábam na zákazku. Doplatok môžete zaplatiť hneď, alebo počkať, kým vám napíšem, že je hotový — ako vám to viac vyhovuje.",
    payBalance: (amount) => `Doplatiť ${amount}`,
    bannerCta: "Pozrieť si",
    manage: "Správa objednávky",
    manageText:
      "Potrebujete niečo zmeniť alebo kúsok reklamovať či vrátiť? Vybavíte to priamo odtiaľto, bez prihlásenia.",
    editOrder: "Upraviť objednávku",
    claimOrReturn: "Reklamácia alebo vrátenie",
    withdrawalOnline:
      "Od zmluvy môžete odstúpiť bez uvedenia dôvodu do 14 dní od prevzatia (netýka sa tovaru vyrobeného na zákazku) — online cez",
    withdrawalLink: "Odstúpiť od zmluvy",
    withdrawalOnlineAfter: " alebo e-mailom.",
    withdrawalPlain:
      "Od zmluvy môžete odstúpiť do 14 dní od prevzatia (netýka sa tovaru vyrobeného na zákazku).",
    contact: "Keby čokoľvek, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
    closing: "Ďakujem a teším sa,",
    orderNumberNote: "Číslo objednávky pre prípadnú komunikáciu:",
    legal: {
      eyebrow: "Zmluva a poučenie",
      confirmations: "potvrdenia zákaziek",
      confirmation: "potvrdenie zákazky",
      orderConfirmation: "potvrdenie objednávky",
      termsAttached: "obchodné podmienky platné pre túto zmluvu",
      withdrawalAttached: "poučenie o odstúpení od zmluvy s formulárom",
      and: " a ",
      intro: "Týmto e-mailom potvrdzujem vašu objednávku a uzavretie kúpnej zmluvy.",
      attachedSentence: (list) => ` V prílohe posielam ${list} (PDF) — uschovajte si ich, prosím.`,
      termsSentence: (version) =>
        ` Zmluva sa riadi obchodnými podmienkami v znení platnom od ${version}; nájdete ich na odkaze nižšie.`,
      docsNote: null,
      seller: "Predávajúca",
      ico: "IČO",
      commissionConfirmation: "Potvrdenie zákazky",
      orderConfirmationTitle: "Potvrdenie objednávky",
      commissionDesc: "· zmluva na výrobok podľa vášho zadania",
      orderConfirmationDesc: "· potvrdenie kúpnej zmluvy (§ 1827 ods. 2 českého Občianskeho zákonníka a čl. 8 ods. 7 smernice 2011/83/EÚ)",
      inAttachment: " — v prílohe (PDF)",
      download: "stiahnuť PDF",
      viewOnWeb: "zobraziť na webe",
      validFrom: "znenie platné od",
      termsLabel: "Obchodné podmienky",
      withdrawalLabel: "Poučenie o odstúpení a formulár",
      complaintsLabel: "Reklamačný poriadok",
      allMadeToOrder:
        "Tovar v tejto objednávke vyrábam podľa vášho zadania, preto od zmluvy nemožno odstúpiť v 14-dňovej lehote (§ 1837 písm. d) českého Občianskeho zákonníka a čl. 16 písm. c) smernice 2011/83/EÚ). Práva zo zodpovednosti za vady vám, samozrejme, zostávajú — pozri reklamačný poriadok.",
      withdrawal: (formAttached) =>
        `Od zmluvy môžete odstúpiť bez uvedenia dôvodu do 14 dní od prevzatia tovaru. Stačí mi to oznámiť — e-mailom, listom alebo ${
          formAttached ? "formulárom z prílohy" : "vzorovým formulárom"
        }, použiť ho však nemusíte. Peniaze vám vrátim do 14 dní od odstúpenia rovnakým spôsobom, akým ste platili; podrobnosti sú v poučení o odstúpení.`,
      madeToOrderException: (items) =>
        ` Výnimkou je tovar vyrobený podľa vášho zadania (${items}) — pri ňom odstúpiť nemožno (§ 1837 písm. d) českého Občianskeho zákonníka a čl. 16 písm. c) smernice 2011/83/EÚ).`,
    },
  },
  pl: {
    preview: "Zamówienie dotarło, dziękuję. Teraz wszystko w moich rękach.",
    eyebrow: "Zamówienie",
    title: "Zamówienie dotarło,",
    accent: "dziękuję.",
    intro: "Dziękuję za zamówienie — jest już u mnie i teraz wszystko w moich rękach.",
    introCommission:
      "Wyrób na zamówienie indywidualne ma swój własny rytm: gdy zacznę go wykonywać, napiszę do Państwa, a potem jeszcze raz, kiedy będzie gotowy.",
    introPickup:
      "Każdy egzemplarz obejrzę i zapakuję; gdy zamówienie będzie gotowe do odbioru w mojej pracowni, dam Państwu znać.",
    introShipping:
      "Każdy egzemplarz obejrzę i starannie zapakuję. Towar dostępny od ręki przekażę przewoźnikowi w ciągu 3 dni roboczych i wyślę Państwu numer przesyłki, żeby mogli ją Państwo śledzić.",
    itemsHeading: "Co Państwo zamówili",
    packaging: "Opakowanie",
    codFee: "Opłata za pobranie",
    glazeAttached: "Szkliwo bezpieczne dla zdrowia — protokół w załączniku: ",
    glaze: "Szkliwo bezpieczne dla zdrowia — protokół: ",
    summary: "Podsumowanie",
    subtotal: "Suma częściowa",
    total: "Razem",
    deliveryPayment: "Dostawa i płatność",
    delivery: "Dostawa",
    pickupInWorkshop: "Odbiór osobisty w pracowni",
    pickupPoint: "Punkt odbioru",
    address: "Adres dostawy",
    payment: "Płatność",
    viewOrder: "Zobacz zamówienie",
    balanceDue: (amount) => `Pozostało do zapłaty: ${amount}.`,
    balanceText:
      "Państwa egzemplarz wykonuję na zamówienie. Dopłatę mogą Państwo uregulować od razu albo poczekać, aż napiszę, że jest gotowy — jak Państwu wygodniej.",
    payBalance: (amount) => `Dopłać ${amount}`,
    bannerCta: "Zobacz",
    manage: "Zarządzanie zamówieniem",
    manageText:
      "Chcą Państwo coś zmienić, zareklamować lub zwrócić? Można to załatwić bezpośrednio stąd, bez logowania.",
    editOrder: "Zmień zamówienie",
    claimOrReturn: "Reklamacja lub zwrot",
    withdrawalOnline:
      "Od umowy mogą Państwo odstąpić bez podania przyczyny w ciągu 14 dni od otrzymania towaru (nie dotyczy wyrobów wykonanych na zamówienie indywidualne) — online przyciskiem",
    withdrawalLink: "Odstąpienie od umowy",
    withdrawalOnlineAfter: " lub e-mailem.",
    withdrawalPlain:
      "Od umowy mogą Państwo odstąpić w ciągu 14 dni od otrzymania towaru (nie dotyczy wyrobów wykonanych na zamówienie indywidualne).",
    contact:
      "W razie jakichkolwiek pytań proszę pisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    closing: "Dziękuję i serdecznie pozdrawiam",
    orderNumberNote: "Numer zamówienia do ewentualnej korespondencji:",
    legal: {
      eyebrow: "Umowa i pouczenie",
      confirmations: "potwierdzenia zamówień indywidualnych",
      confirmation: "potwierdzenie zamówienia indywidualnego",
      orderConfirmation: "potwierdzenie zamówienia",
      termsAttached: "regulamin obowiązujący dla tej umowy",
      withdrawalAttached: "pouczenie o odstąpieniu od umowy wraz z formularzem",
      and: " i ",
      intro: "Tym e-mailem potwierdzam Państwa zamówienie i zawarcie umowy sprzedaży.",
      attachedSentence: (list) => ` W załączniku przesyłam ${list} (PDF) — proszę je zachować.`,
      termsSentence: (version) =>
        ` Umowa podlega regulaminowi w brzmieniu obowiązującym od ${version}; znajdą go Państwo pod linkiem poniżej.`,
      docsNote: " Dokumenty są dostępne w języku czeskim.",
      seller: "Sprzedawca",
      ico: "Nr ident. (IČO)",
      commissionConfirmation: "Potwierdzenie zamówienia indywidualnego",
      orderConfirmationTitle: "Potwierdzenie zamówienia",
      commissionDesc: "· umowa na wykonanie wyrobu według Państwa wytycznych",
      orderConfirmationDesc: "· potwierdzenie umowy sprzedaży (§ 1827 ust. 2 czeskiego kodeksu cywilnego oraz art. 8 ust. 7 dyrektywy 2011/83/UE)",
      inAttachment: " — w załączniku (PDF)",
      download: "pobierz PDF",
      viewOnWeb: "zobacz na stronie",
      validFrom: "wersja obowiązująca od",
      termsLabel: "Regulamin",
      withdrawalLabel: "Pouczenie o odstąpieniu i formularz",
      complaintsLabel: "Zasady reklamacji",
      allMadeToOrder:
        "Towar w tym zamówieniu wykonuję według Państwa wytycznych, dlatego od umowy nie można odstąpić w terminie 14 dni (§ 1837 lit. d) czeskiego kodeksu cywilnego oraz art. 16 lit. c) dyrektywy 2011/83/UE). Uprawnienia z tytułu wad towaru oczywiście Państwu przysługują — szczegóły w zasadach reklamacji.",
      withdrawal: (formAttached) =>
        `Od umowy mogą Państwo odstąpić bez podania przyczyny w ciągu 14 dni od otrzymania towaru. Wystarczy mnie o tym poinformować — e-mailem, listownie albo ${
          formAttached ? "za pomocą formularza z załącznika" : "za pomocą wzoru formularza"
        }, choć korzystanie z formularza nie jest obowiązkowe. Pieniądze zwrócę w ciągu 14 dni od odstąpienia w taki sam sposób, w jaki Państwo zapłacili; szczegóły znajdują się w pouczeniu o odstąpieniu.`,
      madeToOrderException: (items) =>
        ` Wyjątek stanowi towar wykonany według Państwa wytycznych (${items}) — w jego przypadku odstąpienie nie jest możliwe (§ 1837 lit. d) czeskiego kodeksu cywilnego oraz art. 16 lit. c) dyrektywy 2011/83/UE).`,
    },
  },
  de: {
    preview: "Bestellung erhalten, vielen Dank. Jetzt bin ich an der Reihe.",
    eyebrow: "Bestellung",
    title: "Bestellung erhalten,",
    accent: "vielen Dank.",
    intro: "vielen Dank für Ihre Bestellung – sie ist bei mir angekommen, und jetzt bin ich an der Reihe.",
    introCommission:
      "Eine Auftragsarbeit hat ihren eigenen Ablauf: Sobald ich mit der Herstellung beginne, schreibe ich Ihnen – und noch einmal, wenn das Stück fertig ist.",
    introPickup:
      "Ich prüfe jedes Stück und verpacke es; sobald Ihre Bestellung in meiner Werkstatt zur Abholung bereitliegt, gebe ich Ihnen Bescheid.",
    introShipping:
      "Ich prüfe jedes Stück und verpacke es sorgfältig. Vorrätige Ware übergebe ich innerhalb von 3 Werktagen dem Versanddienst und schicke Ihnen die Sendungsnummer, damit Sie das Paket verfolgen können.",
    itemsHeading: "Was Sie bestellt haben",
    packaging: "Verpackung",
    codFee: "Nachnahmegebühr",
    glazeAttached: "Gesundheitlich unbedenkliche Glasur – Prüfprotokoll im Anhang: ",
    glaze: "Gesundheitlich unbedenkliche Glasur – Prüfprotokoll: ",
    summary: "Übersicht",
    subtotal: "Zwischensumme",
    total: "Gesamt",
    deliveryPayment: "Lieferung und Zahlung",
    delivery: "Lieferung",
    pickupInWorkshop: "Abholung in der Werkstatt",
    pickupPoint: "Abholstelle",
    address: "Lieferadresse",
    payment: "Zahlung",
    viewOrder: "Bestellung ansehen",
    balanceDue: (amount) => `Noch offen: ${amount}.`,
    balanceText:
      "Ihr Stück fertige ich auf Bestellung an. Den Restbetrag können Sie gleich bezahlen oder warten, bis ich Ihnen schreibe, dass es fertig ist – ganz wie es Ihnen lieber ist.",
    payBalance: (amount) => `Restbetrag ${amount} bezahlen`,
    bannerCta: "Ansehen",
    manage: "Bestellung verwalten",
    manageText:
      "Möchten Sie etwas ändern oder ein Stück reklamieren bzw. zurückgeben? Das erledigen Sie direkt von hier aus, ohne Anmeldung.",
    editOrder: "Bestellung ändern",
    claimOrReturn: "Reklamation oder Rückgabe",
    withdrawalOnline:
      "Sie können innerhalb von 14 Tagen nach Erhalt ohne Angabe von Gründen vom Vertrag zurücktreten (gilt nicht für Auftragsarbeiten) – online über",
    withdrawalLink: "Vom Vertrag zurücktreten",
    withdrawalOnlineAfter: " oder per E-Mail.",
    withdrawalPlain:
      "Sie können innerhalb von 14 Tagen nach Erhalt vom Vertrag zurücktreten (gilt nicht für Auftragsarbeiten).",
    contact: "Wenn etwas ist, schreiben Sie mir an info@keramickazahrada.cz – ich antworte selbst.",
    closing: "Vielen Dank und herzliche Grüße",
    orderNumberNote: "Bestellnummer für Rückfragen:",
    legal: {
      eyebrow: "Vertrag und Belehrung",
      confirmations: "die Bestätigungen der Auftragsarbeiten",
      confirmation: "die Bestätigung der Auftragsarbeit",
      orderConfirmation: "die Bestellbestätigung",
      termsAttached: "die für diesen Vertrag geltenden AGB",
      withdrawalAttached: "die Widerrufsbelehrung mit Formular",
      and: " und ",
      intro: "Mit dieser E-Mail bestätige ich Ihre Bestellung und den Abschluss des Kaufvertrags.",
      attachedSentence: (list) => ` Im Anhang sende ich Ihnen ${list} (PDF) – bitte bewahren Sie sie auf.`,
      termsSentence: (version) =>
        ` Für den Vertrag gelten die AGB in der Fassung vom ${version}; Sie finden sie über den Link unten.`,
      docsNote: " Die Dokumente liegen auf Tschechisch vor.",
      seller: "Verkäuferin",
      ico: "Ident.-Nr. (IČO)",
      commissionConfirmation: "Bestätigung der Auftragsarbeit",
      orderConfirmationTitle: "Bestellbestätigung",
      commissionDesc: "· Vertrag über ein Stück nach Ihren Vorgaben",
      orderConfirmationDesc:
        "· Bestätigung des Kaufvertrags (§ 1827 Abs. 2 des tschechischen Bürgerlichen Gesetzbuchs und Art. 8 Abs. 7 der Richtlinie 2011/83/EU)",
      inAttachment: " – im Anhang (PDF)",
      download: "PDF herunterladen",
      viewOnWeb: "online ansehen",
      validFrom: "Fassung gültig ab",
      termsLabel: "AGB",
      withdrawalLabel: "Widerrufsbelehrung und Formular",
      complaintsLabel: "Reklamationsordnung",
      allMadeToOrder:
        "Die Ware in dieser Bestellung fertige ich nach Ihren Vorgaben an, deshalb ist ein Rücktritt innerhalb der 14-tägigen Frist ausgeschlossen (§ 1837 Buchst. d des tschechischen Bürgerlichen Gesetzbuchs und Art. 16 Buchst. c der Richtlinie 2011/83/EU). Ihre Gewährleistungsrechte bleiben selbstverständlich bestehen – siehe Reklamationsordnung.",
      withdrawal: (formAttached) =>
        `Sie können innerhalb von 14 Tagen nach Erhalt der Ware ohne Angabe von Gründen vom Vertrag zurücktreten. Es genügt eine Mitteilung an mich – per E-Mail, per Brief oder ${
          formAttached ? "mit dem Formular im Anhang" : "mit dem Musterformular"
        }; das Formular müssen Sie aber nicht verwenden. Den Betrag erstatte ich Ihnen innerhalb von 14 Tagen nach dem Rücktritt auf demselben Weg, auf dem Sie bezahlt haben; Einzelheiten finden Sie in der Widerrufsbelehrung.`,
      madeToOrderException: (items) =>
        ` Ausgenommen ist Ware, die nach Ihren Vorgaben angefertigt wird (${items}) – hier ist ein Rücktritt nicht möglich (§ 1837 Buchst. d des tschechischen Bürgerlichen Gesetzbuchs und Art. 16 Buchst. c der Richtlinie 2011/83/EU).`,
    },
  },
  en: {
    preview: "I've got your order — thank you. It's over to me now.",
    eyebrow: "Order",
    title: "Order received,",
    accent: "thank you.",
    intro: "Thank you for your order — it's safely with me, and now it's over to me.",
    introCommission:
      "A made-to-order piece follows its own timeline: I'll write to you as soon as I start making it, and again when it's finished.",
    introPickup:
      "I'll check and pack every piece; once your order is ready to collect from my studio, I'll let you know.",
    introShipping:
      "I'll check every piece and pack it carefully. Items in stock are handed to the courier within 3 working days, and I'll send you the tracking number so you can follow your parcel.",
    itemsHeading: "What you ordered",
    packaging: "Packaging fee",
    codFee: "Cash on delivery fee",
    glazeAttached: "Food-safe glaze — test report attached: ",
    glaze: "Food-safe glaze — test report: ",
    summary: "Summary",
    subtotal: "Subtotal",
    total: "Total",
    deliveryPayment: "Delivery and payment",
    delivery: "Delivery",
    pickupInWorkshop: "Collection in person at the studio",
    pickupPoint: "Pick-up point",
    address: "Delivery address",
    payment: "Payment",
    viewOrder: "View order",
    balanceDue: (amount) => `Remaining balance: ${amount}.`,
    balanceText:
      "I'm making your piece to order. You can pay the remaining balance now, or wait until I write to say it's finished — whichever suits you best.",
    payBalance: (amount) => `Pay the balance of ${amount}`,
    bannerCta: "Take a look",
    manage: "Manage your order",
    manageText:
      "Need to change something, or want to make a complaint or return a piece? You can do it straight from here, without logging in.",
    editOrder: "Change order",
    claimOrReturn: "Complaint or return",
    withdrawalOnline:
      "You can withdraw from the contract without giving any reason within 14 days of receiving the goods (this does not apply to goods made to order) — online using",
    withdrawalLink: "Withdraw from the contract",
    withdrawalOnlineAfter: ", or by e-mail.",
    withdrawalPlain:
      "You can withdraw from the contract within 14 days of receiving the goods (this does not apply to goods made to order).",
    contact: "If there's anything at all, write to me at info@keramickazahrada.cz — I answer every message myself.",
    closing: "Thank you — I'm looking forward to it,",
    orderNumberNote: "Your order number, should you need to get in touch:",
    legal: {
      eyebrow: "Contract and information",
      confirmations: "the commission confirmations",
      confirmation: "the commission confirmation",
      orderConfirmation: "the order confirmation",
      termsAttached: "the Terms and Conditions that apply to this contract",
      withdrawalAttached: "the information on withdrawal with the withdrawal form",
      and: " and ",
      intro: "With this e-mail I confirm your order and the conclusion of the purchase contract.",
      attachedSentence: (list) => ` Attached you'll find ${list} (PDF) — please keep them for your records.`,
      termsSentence: (version) =>
        ` The contract is governed by the Terms and Conditions in the version effective from ${version}; you'll find them via the link below.`,
      docsNote: " The documents are available in Czech.",
      seller: "Seller",
      ico: "Company ID (IČO)",
      commissionConfirmation: "Commission confirmation",
      orderConfirmationTitle: "Order confirmation",
      commissionDesc: "· contract for a piece made to your specifications",
      orderConfirmationDesc:
        "· confirmation of the purchase contract (Section 1827(2) of the Czech Civil Code and Article 8(7) of Directive 2011/83/EU)",
      inAttachment: " — attached (PDF)",
      download: "download PDF",
      viewOnWeb: "view online",
      validFrom: "version effective from",
      termsLabel: "Terms and Conditions",
      withdrawalLabel: "Information on withdrawal and form",
      complaintsLabel: "Complaints Policy",
      allMadeToOrder:
        "I'm making the goods in this order to your specifications, so the 14-day right of withdrawal does not apply (Section 1837(d) of the Czech Civil Code and Article 16(c) of Directive 2011/83/EU). Your rights in respect of defective goods, of course, remain — see the Complaints Policy.",
      withdrawal: (formAttached) =>
        `You can withdraw from the contract without giving any reason within 14 days of receiving the goods. Simply let me know — by e-mail, by letter or ${
          formAttached ? "using the attached form" : "using the model form"
        }, though you don't have to use it. I'll refund your money within 14 days of your withdrawal, using the same payment method you used; you'll find the details in the information on withdrawal.`,
      madeToOrderException: (items) =>
        ` The exception is goods made to your specifications (${items}) — the right of withdrawal does not apply to them (Section 1837(d) of the Czech Civil Code and Article 16(c) of Directive 2011/83/EU).`,
    },
  },
}

/** Datum verze dokumentu — česky jak je uložené, jinak podle jazyka. */
const versionLabelOf = (doc: OrderLegalDocument, locale: EmailLocale): string =>
  locale === "cs" || !doc.version
    ? doc.version_label
    : (() => {
        const formatted = formatEmailDate(doc.version, locale)
        return formatted === "—" ? doc.version_label : formatted
      })()

/** Výchozí české provedení — v cizojazyčném e-mailu nic neříká. */
const CZECH_DEFAULT_VARIANT = /^(standardní|standard|výchozí)$/i

type OrderPlacedEmailProps = {
  order: OrderDTO & {
    customer: CustomerDTO
  }
  email_banner?: {
    body: string
    title: string
    url: string
  }
  /** Still owed after checkout — only ever non-zero for a commission. */
  balance_due?: number
  balance_currency?: string
  /** Signed „doplatit" link; absent when nothing is owed. */
  balance_payment_url?: string | null
  /**
   * Human label of how the order is paid, built by the caller from the
   * payment session's provider id — „Dobírka — zaplatíte při převzetí",
   * „Online platba přes platební bránu ComGate" (brána bere i převod, Apple
   * Pay a Google Pay — ne jen kartu). Absent when the caller could not tell; the row
   * is simply omitted rather than guessed.
   */
  payment_method?: string
  /** Úprava objednávky přes podepsaný token (`/order/:id/edit`) — i bez účtu. */
  edit_order_url?: string
  /** Reklamace / vrácení / odstoupení přes token (`/order/:id/refund`) — i bez účtu. */
  refund_url?: string
  /**
   * Odstoupení online ve dvou krocích (`/order/:id/odstoupeni`, § 1830a OZ).
   * `null` u čisté zakázky — tam odstoupit nejde (§ 1837 písm. d) OZ).
   */
  withdrawal_url?: string | null
  /**
   * Smlouva a poučení (§ 1827 odst. 2 OZ) — verze OP platná pro objednávku,
   * poučení o odstoupení, prodávající, zakázkové položky. Skládá
   * `lib/legal/order-legal` ve workflow potvrzení. Chybí u starých řádků
   * notifikací — sekce se pak nevykreslí.
   */
  legal?: OrderLegalEmailData
  /**
   * Protokol o nezávadnosti glazury (`lib/glaze-protocols`) — u výrobků,
   * jejichž popis nezávadnost tvrdí, a jen když je ve Studiu publikovaný
   * protokol. `attached` = PDF opravdu jde v příloze.
   */
  glaze_protocol?: {
    item_ids: string[]
    documents: { glaze: string; url: string; attached?: boolean }[]
  } | null
  /**
   * Resend e-mail s přílohami odmítl a provider ho poslal znovu bez nich —
   * text pak nesmí tvrdit „v příloze".
   */
  attachments_failed?: boolean
}

const linkStyle = { color: brand.ink, textDecoration: "underline" } as const

/** „Obchodní podmínky · znění platné od … — v příloze (PDF) · na webu". */
function LegalDocumentLine({
  label,
  doc,
  attached,
}: {
  label: string
  doc: OrderLegalDocument
  attached: boolean
}) {
  const t = useCopy(COPY).legal
  const locale = useEmailLocale()
  const links = [
    attached ? null : doc.pdf_url ? { href: doc.pdf_url, text: t.download } : null,
    doc.page_url ? { href: doc.page_url, text: t.viewOnWeb } : null,
  ].filter((link): link is { href: string; text: string } => Boolean(link))

  return (
    <P small style={{ margin: "0 0 6px" }}>
      <strong style={{ color: brand.ink }}>{label}</strong> · {t.validFrom}{" "}
      {versionLabelOf(doc, locale)}
      {attached ? t.inAttachment : ""}
      {links.map((link, index) => (
        <span key={link.href}>
          {index === 0 ? (attached ? " · " : " — ") : " · "}
          <Link href={link.href} style={linkStyle}>
            {link.text}
          </Link>
        </span>
      ))}
    </P>
  )
}

/**
 * Smlouva a poučení: kdo je prodávající, podle jakého znění OP se smlouva
 * uzavřela (PDF v příloze), a krátce o odstoupení — včetně výjimky pro zboží
 * vyrobené na zakázku (§ 1837 písm. d) OZ). Úplné znění je v poučení.
 */
function LegalSection({
  legal,
  attachmentsFailed,
  localizeTitle,
}: {
  legal: OrderLegalEmailData
  attachmentsFailed: boolean
  /** Český název zakázkové položky → název v jazyce e-mailu. */
  localizeTitle: (title: string) => string
}) {
  const t = useCopy(COPY).legal
  const locale = useEmailLocale()
  const termsAttached = Boolean(legal.terms?.attached) && !attachmentsFailed
  const withdrawalAttached = Boolean(legal.withdrawal?.attached) && !attachmentsFailed
  const seller = legal.seller ?? ({} as OrderLegalEmailData["seller"])
  const sellerLines = [
    seller.name,
    seller.address,
    seller.ico ? `${t.ico} ${seller.ico}` : null,
    [seller.email, seller.phone].filter(Boolean).join(" · ") || null,
  ]
    .filter(Boolean)
    .join("\n")
  const madeToOrder = (legal.made_to_order_items ?? []).map(localizeTitle)
  // Potvrzení zakázky (Z11) — jen u objednávky se zakázkou, a jen když šlo v
  // příloze. Od 20. 10. 2026 jedno na KAŽDOU zakázku objednávky (seznam);
  // staré notifikace mají jen `commission_confirmation`.
  const confirmations =
    legal.commission_confirmations?.length
      ? legal.commission_confirmations
      : legal.commission_confirmation
        ? [legal.commission_confirmation]
        : []
  const confirmationAttached =
    confirmations.some((item) => Boolean(item?.attached)) && !attachmentsFailed

  const attachedNames = [
    confirmationAttached
      ? madeToOrder.length
        ? confirmations.length > 1
          ? t.confirmations
          : t.confirmation
        : t.orderConfirmation
      : null,
    termsAttached ? t.termsAttached : null,
    withdrawalAttached ? t.withdrawalAttached : null,
  ].filter((name): name is string => Boolean(name))
  const attachedList =
    attachedNames.length > 1
      ? `${attachedNames.slice(0, -1).join(", ")}${t.and}${attachedNames[attachedNames.length - 1]}`
      : attachedNames[0] ?? ""

  return (
    <Section
      style={{
        margin: "32px 0 0",
        borderTop: `1px solid ${brand.line}`,
        paddingTop: "24px",
      }}
    >
      <Eyebrow index="06">{t.eyebrow}</Eyebrow>
      <P>
        {t.intro}
        {attachedNames.length
          ? t.attachedSentence(attachedList)
          : legal.terms
            ? t.termsSentence(versionLabelOf(legal.terms, locale))
            : ""}
        {attachedNames.length || legal.terms ? t.docsNote ?? "" : ""}
      </P>

      {sellerLines ? (
        <>
          <LedgerRow label={t.seller} value={<MultiLine value={sellerLines} />} />
          <LedgerEnd />
        </>
      ) : null}

      <Section style={{ margin: "16px 0 0" }}>
        {confirmations.map((confirmation, index) => {
          const attached = Boolean(confirmation?.attached) && !attachmentsFailed
          return (
            <P key={confirmation.url ?? index} small style={{ margin: "0 0 6px" }}>
              {/*
                Objednávka bez zakázkové položky nese klasickou kupní
                smlouvu — „Potvrzení zakázky" by u hrnků bylo nesmyslné.
              */}
              <strong style={{ color: brand.ink }}>
                {madeToOrder.length
                  ? `${t.commissionConfirmation}${confirmations.length > 1 ? ` ${index + 1}/${confirmations.length}` : ""}`
                  : t.orderConfirmationTitle}
              </strong>{" "}
              {madeToOrder.length ? t.commissionDesc : t.orderConfirmationDesc}
              {attached ? t.inAttachment : ""}
              {!attached && confirmation.url ? (
                <>
                  {" — "}
                  <Link href={confirmation.url} style={linkStyle}>
                    {t.download}
                  </Link>
                </>
              ) : null}
            </P>
          )
        })}
        {legal.terms ? (
          <LegalDocumentLine
            label={t.termsLabel}
            doc={legal.terms}
            attached={termsAttached}
          />
        ) : null}
        {legal.withdrawal ? (
          <LegalDocumentLine
            label={t.withdrawalLabel}
            doc={legal.withdrawal}
            attached={withdrawalAttached}
          />
        ) : null}
        {legal.complaints_url ? (
          <P small style={{ margin: "0 0 6px" }}>
            <strong style={{ color: brand.ink }}>{t.complaintsLabel}</strong> —{" "}
            <Link href={legal.complaints_url} style={linkStyle}>
              {t.viewOnWeb}
            </Link>
          </P>
        ) : null}
      </Section>

      {legal.all_made_to_order ? (
        <P small style={{ margin: "16px 0 0" }}>{t.allMadeToOrder}</P>
      ) : (
        <P small style={{ margin: "16px 0 0" }}>
          {t.withdrawal(withdrawalAttached)}
          {madeToOrder.length ? t.madeToOrderException(madeToOrder.join(", ")) : ""}
        </P>
      )}
    </Section>
  )
}

function OrderPlacedEmailComponent({
  order,
  email_banner,
  balance_due,
  balance_payment_url,
  balance_currency,
  payment_method,
  edit_order_url,
  refund_url,
  withdrawal_url,
  legal,
  glaze_protocol,
  attachments_failed,
}: OrderPlacedEmailProps) {
  const t = useCopy(COPY)
  const ui = useUiCopy()
  const locale = useEmailLocale()
  const intl = useIntlLocale()
  const ks = piecesLabel(locale)
  /* Název položky v jazyce e-mailu (`items.product.metadata.title_xx`);
     servisní řádek doběrečného má jen vlastní český `title`. */
  const itemTitle = (item: any): string =>
    locale !== "cs" && item?.metadata?.dobirka_fee && !item?.product_id
      ? t.codFee
      : localizedLineTitle(item, locale)
  const itemVariant = (item: any): string => {
    const variant = String(item?.variant_title ?? "")
    return locale !== "cs" && CZECH_DEFAULT_VARIANT.test(variant.trim()) ? "" : variant
  }
  /* Zakázkové položky v sekci „Smlouva a poučení" chodí jako české názvy. */
  const localizeTitle = (title: string): string => {
    if (locale === "cs") return title
    const match = ((order.items ?? []) as any[]).find(
      (item) => (item?.product_title ?? item?.title ?? "").trim() === title.trim()
    )
    return match ? localizedLineTitle(match, locale) : title
  }
  const glazeDocs = glaze_protocol?.documents ?? []
  const glazeItems = new Set(glazeDocs.length ? glaze_protocol?.item_ids ?? [] : [])
  const glazeAttached = !attachments_failed && glazeDocs.some((doc) => doc.attached)
  const owes = typeof balance_due === "number" && balance_due > 0
  const balanceText = owes
    ? new Intl.NumberFormat(intl, {
        style: "currency",
        currency: (balance_currency || order.currency_code || "CZK").toUpperCase(),
      }).format(balance_due as number)
    : null
  const shouldDisplayBanner = email_banner && "title" in email_banner

  const formatter = new Intl.NumberFormat(intl, {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code,
  })

  const formatPrice = (price: BigNumberValue) => {
    if (typeof price === "number") {
      return formatter.format(price)
    }

    if (typeof price === "string") {
      return formatter.format(parseFloat(price))
    }

    return price?.toString() || ""
  }

  const greetingName =
    order.customer?.first_name || order.shipping_address?.first_name

  // Personal pickup carries `personal_pickup: true` in the shipping method's
  // data — then the address block would talk about a delivery that will never
  // happen, so the pickup line renders instead.
  const isPickup = (order.shipping_methods ?? []).some(
    (method) => (method?.data as Record<string, unknown> | null)?.personal_pickup === true
  )
  // Výdejna (Balíkovna): doručovací adresa je VÝDEJNA, ne domácí adresa
  // zákazníka. Bere se z metadat (point zapisuje jen tam), ať e-mail neukazuje
  // adresu zákazníka domů u zásilky, co míří na výdejnu.
  const meta = (order as { metadata?: Record<string, unknown> | null }).metadata
  const balikovnaName =
    typeof meta?.balikovna_point_name === "string" ? meta.balikovna_point_name : ""
  const balikovnaAddress =
    typeof meta?.balikovna_point_address === "string" ? meta.balikovna_point_address : ""
  const pickupPoint = balikovnaName
    ? [balikovnaName, balikovnaAddress].filter(Boolean).join(", ")
    : ""
  const address = order.shipping_address
  const addressNode = address ? (
    <>
      {[address.first_name, address.last_name].filter(Boolean).join(" ")}
      <br />
      {address.address_1}
      {address.address_2 ? (
        <>
          <br />
          {address.address_2}
        </>
      ) : null}
      <br />
      {[address.postal_code, address.city].filter(Boolean).join(" ")}
    </>
  ) : null

  const trackUrl = orderLink(order)

  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow index="01">{t.eyebrow} {`#${order.display_id}`}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <P>{greetingName ? ui.helloName(greetingName) : ui.hello}</P>
      <P>
        {t.intro}{" "}
        {owes || legal?.all_made_to_order
          ? t.introCommission
          : isPickup
            ? t.introPickup
            : t.introShipping}
      </P>

      {/* Výrobky */}
      <Section style={{ margin: "32px 0 0" }}>
        <Eyebrow index="02">{t.itemsHeading}</Eyebrow>
        {/* Balné (lib/packaging.ts) je vlastní položka — hned pod svým
            výrobkem, menším řádkem bez fotky a bez pořadového čísla. */}
        {withPackagingUnderProducts((order.items ?? []) as any[]).map((item: any) =>
          isPackagingLine(item) ? (
            <Row key={item.id}>
              <Column style={{ width: "68px" }} />
              <Column style={{ padding: "0 0 12px", verticalAlign: "top" }}>
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "12px",
                    lineHeight: "18px",
                    color: brand.muted,
                    margin: 0,
                  }}
                >
                  {t.packaging}
                  {Number(item.quantity) > 1 ? ` · ${item.quantity} ${ks}` : ""}
                </Text>
              </Column>
              <Column align="right" style={{ padding: "0 0 12px", verticalAlign: "top", width: "110px" }}>
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "12px",
                    lineHeight: "18px",
                    color: brand.muted,
                    margin: 0,
                  }}
                >
                  {formatPrice(item.total)}
                </Text>
              </Column>
            </Row>
          ) : (
          <Row key={item.id} style={{ borderTop: `1px solid ${brand.line}` }}>
            <Column
              style={{ width: "68px", padding: "14px 14px 14px 0", verticalAlign: "top" }}
            >
              {item.thumbnail ? (
                <Img
                  src={item.thumbnail}
                  alt={itemTitle(item)}
                  width="56"
                  height="66"
                  style={{
                    borderRadius: "10px",
                    objectFit: "cover",
                    backgroundColor: brand.stone,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "56px",
                    height: "66px",
                    borderRadius: "10px",
                    backgroundColor: brand.stone,
                  }}
                />
              )}
            </Column>
            <Column style={{ padding: "14px 0", verticalAlign: "top" }}>
              <Text
                style={{
                  fontFamily: brand.sans,
                  fontSize: "10px",
                  lineHeight: "14px",
                  letterSpacing: "1.8px",
                  color: brand.faint,
                  margin: "0 0 4px",
                }}
              >
                {String(
                  ((order.items ?? []) as any[])
                    .filter((line) => !isPackagingLine(line))
                    .findIndex((line) => line.id === item.id) + 1
                ).padStart(2, "0")}
              </Text>
              <Text
                style={{
                  fontFamily: brand.serif,
                  fontSize: "17px",
                  lineHeight: "22px",
                  color: brand.ink,
                  margin: 0,
                }}
              >
                {/* Fee lines (doběrečné) have no product — the item's own
                    title is the honest fallback. */}
                {itemTitle(item)}
              </Text>
              {itemVariant(item) ? (
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "12px",
                    lineHeight: "18px",
                    color: brand.muted,
                    margin: "2px 0 0",
                  }}
                >
                  {itemVariant(item)}
                  {item.quantity > 1 ? ` · ${item.quantity} ${ks}` : ""}
                </Text>
              ) : null}
              {glazeItems.has(String(item.id)) ? (
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "12px",
                    lineHeight: "18px",
                    color: brand.muted,
                    margin: "4px 0 0",
                  }}
                >
                  {glazeAttached ? t.glazeAttached : t.glaze}
                  {glazeDocs.map((doc, index) => (
                    <span key={doc.url}>
                      {index ? ", " : ""}
                      <Link href={doc.url} style={linkStyle}>
                        {glazeDocs.length > 1 ? doc.glaze : "PDF"}
                      </Link>
                    </span>
                  ))}
                </Text>
              ) : null}
            </Column>
            <Column
              align="right"
              style={{ padding: "14px 0", verticalAlign: "top", width: "110px" }}
            >
              <Text
                style={{
                  fontFamily: brand.serif,
                  fontSize: "16px",
                  lineHeight: "22px",
                  color: brand.ink,
                  margin: 0,
                }}
              >
                {formatPrice(item.total)}
              </Text>
            </Column>
          </Row>
          )
        )}
        <LedgerEnd />
      </Section>

      {/* Souhrn */}
      <Section style={{ margin: "32px 0 0" }}>
        <Eyebrow index="03">{t.summary}</Eyebrow>
        <LedgerRow label={t.subtotal} value={formatPrice(order.item_total)} />
        {order.shipping_methods?.map((method) => (
          <LedgerRow
            key={method.id}
            label={
              /* Názvy dopravy jsou česká data z administrace; osobní odběr se
                 v cizím jazyce pozná podle příznaku, dopravce zůstane jménem. */
              locale !== "cs" &&
              (method?.data as Record<string, unknown> | null)?.personal_pickup === true
                ? t.pickupInWorkshop
                : method.name
            }
            value={formatPrice(method.total)}
          />
        ))}
        {/* No tax row on purpose: the seller is not a VAT payer, so a „Daň"
            line — even a zero one — would be a claim the invoice contradicts. */}
        <LedgerRow label={t.total} value={formatPrice(order.total)} strong />
        <LedgerEnd />
      </Section>

      {/* Doručení a platba — the two answers every confirmation gets asked
          for: kam to přijde a jak se to platí. Rows render only from real
          data; nothing here is guessed. */}
      {(payment_method || isPickup || pickupPoint || addressNode) && (
        <Section style={{ margin: "32px 0 0" }}>
          <Eyebrow index="04">{t.deliveryPayment}</Eyebrow>
          {isPickup ? (
            <LedgerRow label={t.delivery} value={t.pickupInWorkshop} />
          ) : pickupPoint ? (
            <LedgerRow label={t.pickupPoint} value={`Balíkovna — ${pickupPoint}`} />
          ) : addressNode ? (
            <LedgerRow label={t.address} value={addressNode} />
          ) : null}
          {payment_method ? (
            <LedgerRow label={t.payment} value={payment_method} />
          ) : null}
          <LedgerEnd />
        </Section>
      )}

      {/* The one click the mail offers: where the order lives. The link is
          built by lib/storefront-url — no configured storefront, no button. */}
      {trackUrl && (
        <ButtonRow>
          <EmailButton href={trackUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      )}

      {/*
        Outstanding balance on a commission. Shown only when something is
        genuinely owed — a piece paid in full at checkout must never be
        asked for more, and an ordinary order never reaches this at all.
      */}
      {owes && (
        <Section style={{ margin: "32px 0 0" }}>
          <Note tone="clay">{t.balanceDue(balanceText ?? "")}</Note>
          <P>{t.balanceText}</P>
          {balance_payment_url && (
            <ButtonRow>
              <EmailButton href={balance_payment_url}>
                {t.payBalance(balanceText ?? "")}
              </EmailButton>
            </ButtonRow>
          )}
        </Section>
      )}

      {/* Volitelný promo blok */}
      {shouldDisplayBanner && (
        <Section
          style={{
            margin: "32px 0 0",
            borderTop: `1px solid ${brand.line}`,
            paddingTop: "24px",
          }}
        >
          <Text
            style={{
              fontFamily: brand.serif,
              fontSize: "19px",
              lineHeight: "26px",
              color: brand.ink,
              margin: "0 0 8px",
            }}
          >
            {email_banner.title}
          </Text>
          <P>{email_banner.body}</P>
          <EmailButton href={email_banner.url} variant="ghost">
            {t.bannerCta}
          </EmailButton>
        </Section>
      )}

      {/* Správa objednávky z e-mailu: úprava a reklamace/vrácení/odstoupení.
          Oba odkazy nesou podepsaný token, takže fungují i bez přihlášení. */}
      {(edit_order_url || refund_url) && (
        <Section
          style={{
            margin: "32px 0 0",
            borderTop: `1px solid ${brand.line}`,
            paddingTop: "24px",
          }}
        >
          <Eyebrow index="05">{t.manage}</Eyebrow>
          <P>{t.manageText}</P>
          <ButtonRow>
            {edit_order_url ? (
              <EmailButton href={edit_order_url} variant="ghost">
                {t.editOrder}
              </EmailButton>
            ) : null}
            {edit_order_url && refund_url ? (
              <span style={{ display: "inline-block", width: "12px" }} />
            ) : null}
            {refund_url ? (
              <EmailButton href={refund_url} variant="ghost">
                {t.claimOrReturn}
              </EmailButton>
            ) : null}
          </ButtonRow>
          {withdrawal_url ? (
            <P small style={{ margin: "14px 0 0", color: brand.faint }}>
              {t.withdrawalOnline}{" "}
              <Link
                href={withdrawal_url}
                style={{ color: brand.ink, textDecoration: "underline" }}
              >
                {t.withdrawalLink}
              </Link>
              {t.withdrawalOnlineAfter}
            </P>
          ) : legal?.all_made_to_order ? null : (
            // Čistá zakázka: od smlouvy odstoupit nejde (§ 1837 písm. d) OZ,
            // sekce „Smlouva a poučení") — věta o 14 dnech by jí odporovala.
            <P small style={{ margin: "14px 0 0", color: brand.faint }}>
              {t.withdrawalPlain}
            </P>
          )}
        </Section>
      )}

      {legal ? (
        <LegalSection
          legal={legal}
          attachmentsFailed={Boolean(attachments_failed)}
          localizeTitle={localizeTitle}
        />
      ) : null}

      <P style={{ margin: "32px 0 0" }}>{t.contact}</P>
      <Signature closing={t.closing} />

      <P small style={{ margin: "28px 0 0", color: brand.faint }}>
        {/* The display number, not the internal `order_01…` id — the internal
            id reads as computer noise and the admin finds the order by number. */}
        {t.orderNumberNote} {`#${order.display_id}`}
      </P>
    </EmailLayout>
  )
}

export const orderPlacedEmail = (props: OrderPlacedEmailProps) => (
  <OrderPlacedEmailComponent {...props} />
)


const mockOrder = {
  "order": {
    "id": "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    "display_id": 42,
    "email": "jana.novakova@example.cz",
    "currency_code": "czk",
    "total": 1579,
    "subtotal": 1579,
    "discount_total": 0,
    "shipping_total": 129,
    "tax_total": 0,
    "item_subtotal": 1450,
    "item_total": 1450,
    "item_tax_total": 0,
    "customer_id": "cus_01JSNXD6VQC1YH56E4TGC81NWX",
    "items": [
      {
        "id": "ordli_01JSNXDH9C47KZ43WQ3TBFXZA9",
        "title": "Ø 32 cm",
        "subtitle": "Zahradní mísa z pálené hlíny",
        "thumbnail": "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        "variant_id": "variant_01JSNXAQCZ5X81A3NRSVFJ3ZHQ",
        "product_id": "prod_01JSNXAQBQ6MFV5VHKN420NXQW",
        "product_title": "Zahradní mísa z pálené hlíny",
        "product_description": "Ručně točená mísa z písecké hlíny, pálená v peci ateliéru.",
        "product_subtitle": null,
        "product_type": null,
        "product_type_id": null,
        "product_collection": null,
        "product_handle": "zahradni-misa",
        "variant_sku": "MISA-32",
        "variant_barcode": null,
        "variant_title": "Ø 32 cm",
        "variant_option_values": null,
        "requires_shipping": true,
        "is_giftcard": false,
        "is_discountable": true,
        "is_tax_inclusive": false,
        "is_custom_price": false,
        "metadata": {},
        "raw_compare_at_unit_price": null,
        "raw_unit_price": {
          "value": "1450",
          "precision": 20
        },
        "created_at": new Date(),
        "updated_at": new Date(),
        "deleted_at": null,
        "tax_lines": [],
        "adjustments": [],
        "compare_at_unit_price": null,
        "unit_price": 1450,
        "quantity": 1,
        "raw_quantity": {
          "value": "1",
          "precision": 20
        },
        "detail": {
          "id": "orditem_01JSNXDH9DK1XMESEZPADYFWKY",
          "version": 1,
          "metadata": null,
          "order_id": "order_01JSNXDH9BPJWWKVW03B9E9KW8",
          "raw_unit_price": null,
          "raw_compare_at_unit_price": null,
          "raw_quantity": {
            "value": "1",
            "precision": 20
          },
          "raw_fulfilled_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_delivered_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_shipped_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_return_requested_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_return_received_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_return_dismissed_quantity": {
            "value": "0",
            "precision": 20
          },
          "raw_written_off_quantity": {
            "value": "0",
            "precision": 20
          },
          "created_at": new Date(),
          "updated_at": new Date(),
          "deleted_at": null,
          "item_id": "ordli_01JSNXDH9C47KZ43WQ3TBFXZA9",
          "unit_price": null,
          "compare_at_unit_price": null,
          "quantity": 1,
          "fulfilled_quantity": 0,
          "delivered_quantity": 0,
          "shipped_quantity": 0,
          "return_requested_quantity": 0,
          "return_received_quantity": 0,
          "return_dismissed_quantity": 0,
          "written_off_quantity": 0
        },
        "subtotal": 1450,
        "total": 1450,
        "original_total": 1450,
        "discount_total": 0,
        "discount_subtotal": 0,
        "discount_tax_total": 0,
        "tax_total": 0,
        "original_tax_total": 0,
        "refundable_total_per_unit": 1450,
        "refundable_total": 1450,
        "fulfilled_total": 0,
        "shipped_total": 0,
        "return_requested_total": 0,
        "return_received_total": 0,
        "return_dismissed_total": 0,
        "write_off_total": 0,
        "raw_subtotal": {
          "value": "1450",
          "precision": 20
        },
        "raw_total": {
          "value": "1450",
          "precision": 20
        },
        "raw_original_total": {
          "value": "1450",
          "precision": 20
        },
        "raw_discount_total": {
          "value": "0",
          "precision": 20
        },
        "raw_discount_subtotal": {
          "value": "0",
          "precision": 20
        },
        "raw_discount_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_original_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_refundable_total_per_unit": {
          "value": "1450",
          "precision": 20
        },
        "raw_refundable_total": {
          "value": "1450",
          "precision": 20
        },
        "raw_fulfilled_total": {
          "value": "0",
          "precision": 20
        },
        "raw_shipped_total": {
          "value": "0",
          "precision": 20
        },
        "raw_return_requested_total": {
          "value": "0",
          "precision": 20
        },
        "raw_return_received_total": {
          "value": "0",
          "precision": 20
        },
        "raw_return_dismissed_total": {
          "value": "0",
          "precision": 20
        },
        "raw_write_off_total": {
          "value": "0",
          "precision": 20
        }
      }
    ],
    "shipping_address": {
      "id": "caaddr_01JSNXD6W0TGPH2JQD18K97B25",
      "customer_id": null,
      "company": "",
      "first_name": "Jana",
      "last_name": "Nováková",
      "address_1": "Putim 229",
      "address_2": "",
      "city": "Písek",
      "country_code": "cz",
      "province": "",
      "postal_code": "397 01",
      "phone": "",
      "metadata": null,
      "created_at": "2025-04-25T07:25:48.801Z",
      "updated_at": "2025-04-25T07:25:48.801Z",
      "deleted_at": null
    },
    "billing_address": {
      "id": "caaddr_01JSNXD6W0V7RNZH63CPG26K5W",
      "customer_id": null,
      "company": "",
      "first_name": "Jana",
      "last_name": "Nováková",
      "address_1": "Putim 229",
      "address_2": "",
      "city": "Písek",
      "country_code": "cz",
      "province": "",
      "postal_code": "397 01",
      "phone": "",
      "metadata": null,
      "created_at": "2025-04-25T07:25:48.801Z",
      "updated_at": "2025-04-25T07:25:48.801Z",
      "deleted_at": null
    },
    "shipping_methods": [
      {
        "id": "ordsm_01JSNXDH9B9DDRQXJT5J5AE5V1",
        "name": "Zásilkovna",
        "description": null,
        "is_tax_inclusive": false,
        "is_custom_amount": false,
        "shipping_option_id": "so_01JSNXAQA64APG6BNHGCMCTN6V",
        "data": {},
        "metadata": null,
        "raw_amount": {
          "value": "129",
          "precision": 20
        },
        "created_at": new Date(),
        "updated_at": new Date(),
        "deleted_at": null,
        "tax_lines": [],
        "adjustments": [],
        "amount": 129,
        "order_id": "order_01JSNXDH9BPJWWKVW03B9E9KW8",
        "detail": {
          "id": "ordspmv_01JSNXDH9B5RAF4FH3M1HH3TEA",
          "version": 1,
          "order_id": "order_01JSNXDH9BPJWWKVW03B9E9KW8",
          "return_id": null,
          "exchange_id": null,
          "claim_id": null,
          "created_at": new Date(),
          "updated_at": new Date(),
          "deleted_at": null,
          "shipping_method_id": "ordsm_01JSNXDH9B9DDRQXJT5J5AE5V1"
        },
        "subtotal": 129,
        "total": 129,
        "original_total": 129,
        "discount_total": 0,
        "discount_subtotal": 0,
        "discount_tax_total": 0,
        "tax_total": 0,
        "original_tax_total": 0,
        "raw_subtotal": {
          "value": "129",
          "precision": 20
        },
        "raw_total": {
          "value": "129",
          "precision": 20
        },
        "raw_original_total": {
          "value": "129",
          "precision": 20
        },
        "raw_discount_total": {
          "value": "0",
          "precision": 20
        },
        "raw_discount_subtotal": {
          "value": "0",
          "precision": 20
        },
        "raw_discount_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_tax_total": {
          "value": "0",
          "precision": 20
        },
        "raw_original_tax_total": {
          "value": "0",
          "precision": 20
        }
      }
    ],
    "customer": {
      "id": "cus_01JSNXD6VQC1YH56E4TGC81NWX",
      "company_name": null,
      "first_name": "Jana",
      "last_name": "Nováková",
      "email": "jana.novakova@example.cz",
      "phone": null,
      "has_account": false,
      "metadata": null,
      "created_by": null,
      "created_at": "2025-04-25T07:25:48.791Z",
      "updated_at": "2025-04-25T07:25:48.791Z",
      "deleted_at": null
    }
  }
}
// @ts-ignore
export default () => (
  // @ts-ignore
  <OrderPlacedEmailComponent
    {...mockOrder}
    payment_method="ComGate"
    edit_order_url="https://keramickazahrada.cz/cz/order/order_12345/edit?token=abc123"
    refund_url="https://keramickazahrada.cz/cz/order/order_12345/refund?token=abc123"
    legal={{
      seller: {
        name: "Lucie Polanská",
        address: "Putim 229, 397 01 Písek",
        ico: "03441482",
        email: "info@keramickazahrada.cz",
        phone: "+420 775 211 578",
        web: "keramickazahrada.cz",
        webUrl: "https://keramickazahrada.cz",
      },
      terms: {
        slug: "obchodni-podminky",
        title: "Obchodní podmínky",
        version: "2026-11-03",
        version_label: "3. 11. 2026",
        page_url: "https://keramickazahrada.cz/cz/smluvni-podminky/2026-11-03",
        pdf_url: "https://img.matejforejt.com/legal/obchodni-podminky-2026-11-03.pdf",
        pdf_draft: false,
        in_manifest: true,
        attached: true,
      },
      withdrawal: {
        slug: "odstoupeni-od-smlouvy",
        title: "Odstoupení od smlouvy",
        version: "2026-11-03",
        version_label: "3. 11. 2026",
        page_url: "https://keramickazahrada.cz/cz/odstoupeni-od-smlouvy",
        pdf_url: "https://img.matejforejt.com/legal/odstoupeni-od-smlouvy-2026-11-03.pdf",
        pdf_draft: false,
        in_manifest: true,
        attached: true,
      },
      terms_url: "https://keramickazahrada.cz/cz/smluvni-podminky",
      withdrawal_url: "https://keramickazahrada.cz/cz/odstoupeni-od-smlouvy",
      complaints_url: "https://keramickazahrada.cz/cz/reklamacni-rad",
      privacy_url: "https://keramickazahrada.cz/cz/ochrana-osobnich-udaju",
      made_to_order_items: [],
      all_made_to_order: false,
    }}
  />
)
