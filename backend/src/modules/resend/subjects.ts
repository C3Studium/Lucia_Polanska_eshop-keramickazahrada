import type { EmailLocale } from "../../lib/email-locale"

/**
 * Předměty zákaznických e-mailů ve slovenštině, polštině, němčině a angličtině.
 *
 * Čeština zůstává v `getTemplateSubject` v provideru (tam je i komentář,
 * proč který předmět zní, jak zní — např. „Zakázka je ve výrobě" musí
 * začínat přesně tak, protože se na něj odvolávají obchodní podmínky).
 * Tady jsou jen překlady; šablona, která tu chybí, jde česky — to platí
 * záměrně pro e-maily majitelce (oznámení, souhrny), pozvánku do
 * administrace a kurzy, které se prodávají jen na /cz.
 *
 * Předmět poslaný v `data.subject` má přednost i tady — odesílatel, který
 * ho skládá, ho musí skládat v jazyce zákazníka (`pick` z `lib/email-locale`).
 */
export const LOCALIZED_SUBJECTS: Record<string, Record<Exclude<EmailLocale, "cs">, string>> = {
  "order-placed": {
    sk: "Objednávku mám, ďakujem",
    pl: "Zamówienie dotarło, dziękuję",
    de: "Ihre Bestellung ist da – vielen Dank",
    en: "Order received — thank you",
  },
  "password-reset": {
    sk: "Nové heslo — odkaz platí 15 minút",
    pl: "Nowe hasło — link jest ważny 15 minut",
    de: "Neues Passwort – der Link gilt 15 Minuten",
    en: "Your new password — the link is valid for 15 minutes",
  },
  "email-verification": {
    sk: "Potvrďte svoju e-mailovú adresu",
    pl: "Prosimy o potwierdzenie adresu e-mail",
    de: "Bitte bestätigen Sie Ihre E-Mail-Adresse",
    en: "Please confirm your e-mail address",
  },
  "variant-restock": {
    sk: "Váš obľúbený kúsok je späť na sklade",
    pl: "Ulubiony egzemplarz znów jest dostępny",
    de: "Ihr Lieblingsstück ist wieder vorrätig",
    en: "Your favourite piece is back in stock",
  },
  "abandoned-cart": {
    sk: "Nezabudli ste na niečo?",
    pl: "Czy czegoś Państwo nie zapomnieli?",
    de: "Haben Sie etwas vergessen?",
    en: "Did you forget something?",
  },
  "payment-received": {
    sk: "Platba dorazila, ďakujem",
    pl: "Płatność dotarła, dziękuję",
    de: "Ihre Zahlung ist angekommen – vielen Dank",
    en: "Your payment has arrived — thank you",
  },
  "payment-failed": {
    sk: "Platba neprešla — skúste to, prosím, znova",
    pl: "Płatność nie przeszła — proszę spróbować ponownie",
    de: "Die Zahlung hat nicht geklappt – bitte versuchen Sie es noch einmal",
    en: "Your payment didn't go through — please try again",
  },
  "payment-pending": {
    sk: "Prosím o doplatok za vašu zákazku",
    pl: "Prośba o dopłatę za zamówienie indywidualne",
    de: "Bitte um die Restzahlung für Ihre Auftragsarbeit",
    en: "Balance payment for your commission",
  },
  "payment-refunded": {
    sk: "Vraciam vám peniaze",
    pl: "Zwracam Państwu pieniądze",
    de: "Ich erstatte Ihnen den Betrag",
    en: "I'm refunding your money",
  },
  "order-shipment": {
    sk: "Objednávka je na ceste k vám",
    pl: "Zamówienie jest już w drodze",
    de: "Ihre Bestellung ist unterwegs",
    en: "Your order is on its way",
  },
  "order-cancelled": {
    sk: "Vaša objednávka je zrušená",
    pl: "Zamówienie zostało anulowane",
    de: "Ihre Bestellung wurde storniert",
    en: "Your order has been cancelled",
  },
  "order-processing": {
    sk: "Zákazka je vo výrobe — pustila som sa do nej",
    pl: "Zamówienie indywidualne jest w realizacji — zaczęłam pracę",
    de: "Ihre Auftragsarbeit ist in Arbeit – ich habe damit begonnen",
    en: "Your commission is in production — I've made a start",
  },
  "production-started": {
    sk: "Zákazka je vo výrobe — pustila som sa do nej",
    pl: "Zamówienie indywidualne jest w realizacji — zaczęłam pracę",
    de: "Ihre Auftragsarbeit ist in Arbeit – ich habe damit begonnen",
    en: "Your commission is in production — I've made a start",
  },
  "commission-cancelled": {
    sk: "Zákazka je zrušená — ako je to s peniazmi",
    pl: "Zamówienie indywidualne anulowane — co z pieniędzmi",
    de: "Auftragsarbeit storniert – so geht es mit dem Geld weiter",
    en: "Your commission has been cancelled — what happens to your money",
  },
  "commission-confirmed": {
    sk: "Zadanie vašej zákazky je potvrdené",
    pl: "Szczegóły zamówienia indywidualnego są potwierdzone",
    de: "Die Vorgaben für Ihre Auftragsarbeit sind bestätigt",
    en: "The brief for your commission is confirmed",
  },
  "order-preparing": {
    sk: "Vašu objednávku práve balím",
    pl: "Właśnie pakuję Państwa zamówienie",
    de: "Ich packe gerade Ihre Bestellung",
    en: "I'm packing your order right now",
  },
  "order-edited": {
    sk: "Úpravu objednávky mám uloženú",
    pl: "Zmiana zamówienia została zapisana",
    de: "Die Änderung Ihrer Bestellung ist gespeichert",
    en: "The change to your order is saved",
  },
  "order-ready": {
    sk: "Zabalené, čaká už len na prepravcu",
    pl: "Zapakowane, czeka już tylko na kuriera",
    de: "Verpackt – wartet nur noch auf den Versand",
    en: "All packed — just waiting for the courier",
  },
  "commission-completed": {
    sk: "Vaša zákazka je hotová",
    pl: "Zamówienie indywidualne jest gotowe",
    de: "Ihre Auftragsarbeit ist fertig",
    en: "Your commission is finished",
  },
  "order-refunded": {
    sk: "Peniaze sú na ceste späť k vám",
    pl: "Pieniądze są już w drodze do Państwa",
    de: "Ihr Geld ist auf dem Weg zurück zu Ihnen",
    en: "Your money is on its way back to you",
  },
  "order-review": {
    sk: "Ako sa vám s ním žije?",
    pl: "Jak się sprawdza w Państwa domu?",
    de: "Wie gefällt es Ihnen?",
    en: "How are you getting on with it?",
  },
  "order-ready-pickup": {
    sk: "Objednávka na vás čaká v dielni",
    pl: "Zamówienie czeka na Państwa w pracowni",
    de: "Ihre Bestellung wartet in der Werkstatt auf Sie",
    en: "Your order is waiting for you at the studio",
  },
  "order-delivered": {
    sk: "Kúsky sú u vás — ďakujem",
    pl: "Ceramika jest już u Państwa — dziękuję",
    de: "Ihre Stücke sind bei Ihnen – vielen Dank",
    en: "Your pieces have arrived — thank you",
  },
  "order-delayed": {
    sk: "Ospravedlňujem sa, objednávka sa oneskorí",
    pl: "Przepraszam, zamówienie się opóźni",
    de: "Es tut mir leid – Ihre Bestellung verzögert sich",
    en: "I'm sorry, your order will be delayed",
  },
  welcome: {
    sk: "Vitajte v Keramickej záhrade",
    pl: "Witamy w Keramickiej Zahradzie",
    de: "Willkommen in der Keramická zahrada",
    en: "Welcome to Keramická zahrada",
  },
  "account-deleted": {
    sk: "Váš účet som zmazala",
    pl: "Konto zostało usunięte",
    de: "Ihr Konto wurde gelöscht",
    en: "I've deleted your account",
  },
  "return-approved": {
    sk: "Vašu žiadosť som schválila",
    pl: "Państwa wniosek został zaakceptowany",
    de: "Ihre Anfrage ist genehmigt",
    en: "I've approved your request",
  },
  "newsletter-signup": {
    sk: "Novinky z dielne — potvrďte, prosím, odber",
    pl: "Nowości z pracowni — prosimy potwierdzić subskrypcję",
    de: "Neuigkeiten aus der Werkstatt – bitte bestätigen Sie Ihr Abo",
    en: "News from the studio — please confirm your subscription",
  },
  "newsletter-unsubscribe": {
    sk: "Odhlásenie z noviniek je hotové",
    pl: "Wypisanie z newslettera zakończone",
    de: "Sie sind vom Newsletter abgemeldet",
    en: "You've been unsubscribed from the newsletter",
  },
  "newsletter-welcome": {
    sk: "Odber noviniek je potvrdený — ďakujem",
    pl: "Subskrypcja potwierdzona — dziękuję",
    de: "Ihr Newsletter-Abo ist bestätigt – vielen Dank",
    en: "Your subscription is confirmed — thank you",
  },
  "refund-request": {
    sk: "Vašu žiadosť som prijala",
    pl: "Państwa zgłoszenie dotarło",
    de: "Ihre Anfrage ist bei mir eingegangen",
    en: "I've received your request",
  },
  "return-rejected": {
    sk: "Žiadosti bohužiaľ nemôžem vyhovieť",
    pl: "Niestety nie mogę uwzględnić zgłoszenia",
    de: "Ihrer Anfrage kann ich leider nicht entsprechen",
    en: "Unfortunately, I can't grant your request",
  },
  "return-received": {
    sk: "Tovar ku mne dorazil",
    pl: "Towar do mnie dotarł",
    de: "Die Ware ist bei mir angekommen",
    en: "Your parcel has reached me",
  },
  "return-resolved": {
    sk: "Potvrdenie o vybavení",
    pl: "Potwierdzenie rozpatrzenia",
    de: "Bestätigung der Erledigung",
    en: "Confirmation that your request has been settled",
  },
  "price-drop": {
    sk: "Obľúbený kúsok má nižšiu cenu",
    pl: "Ulubiony egzemplarz jest tańszy",
    de: "Ihr Lieblingsstück ist jetzt günstiger",
    en: "Your favourite piece now costs less",
  },
  "invoice-issued": {
    sk: "Faktúra k vašej objednávke",
    pl: "Faktura do Państwa zamówienia",
    de: "Rechnung zu Ihrer Bestellung",
    en: "The invoice for your order",
  },
  "contract-resent": {
    sk: "Potvrdenie zmluvy k vašej objednávke",
    pl: "Potwierdzenie umowy do Państwa zamówienia",
    de: "Vertragsbestätigung zu Ihrer Bestellung",
    en: "Contract confirmation for your order",
  },
  "commission-inquiry-received": {
    sk: "Ďakujem za dopyt — ozvem sa s ponukou",
    pl: "Dziękuję za zapytanie — odezwę się z ofertą",
    de: "Danke für Ihre Anfrage – ich melde mich mit einem Angebot",
    en: "Thank you for your enquiry — I'll be in touch with an offer",
  },
  "gift-voucher": {
    sk: "Darčekový poukaz do Keramickej záhrady",
    pl: "Bon podarunkowy do Keramickiej Zahrady",
    de: "Geschenkgutschein für die Keramická zahrada",
    en: "A gift voucher for Keramická zahrada",
  },
  "gift-voucher-payment": {
    sk: "Darčekový poukaz — odkaz na zaplatenie",
    pl: "Bon podarunkowy — link do płatności",
    de: "Geschenkgutschein – Link zur Zahlung",
    en: "Gift voucher — your payment link",
  },
  "commission-price-agreed": {
    sk: "Dohodnutá cena za vašu zákazku",
    pl: "Uzgodniona cena zamówienia indywidualnego",
    de: "Der vereinbarte Preis für Ihre Auftragsarbeit",
    en: "The agreed price for your commission",
  },
  "surcharge-notice": {
    sk: "K vašej zákazke pribudol príplatok",
    pl: "Do zamówienia indywidualnego doszła dopłata",
    de: "Zu Ihrer Auftragsarbeit kommt ein Aufpreis hinzu",
    en: "A surcharge has been added to your commission",
  },
  "surcharge-confirmed": {
    sk: "Príplatok k zákazke — ako sme sa dohodli",
    pl: "Dopłata do zamówienia — tak jak się umówiliśmy",
    de: "Aufpreis für Ihre Auftragsarbeit – wie besprochen",
    en: "The surcharge for your commission — as we agreed",
  },
  "commission-message": {
    sk: "Správa z dielne k vašej zákazke",
    pl: "Wiadomość z pracowni w sprawie zamówienia",
    de: "Nachricht aus der Werkstatt zu Ihrer Auftragsarbeit",
    en: "A message from the studio about your commission",
  },
}

/** Přeložený předmět, nebo `null` (pak platí český z provideru). */
export const localizedSubject = (
  template: string,
  locale: EmailLocale | null | undefined
): string | null => {
  if (!locale || locale === "cs") return null
  return LOCALIZED_SUBJECTS[template]?.[locale] ?? null
}
