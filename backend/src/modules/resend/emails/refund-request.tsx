import * as React from "react"
import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  MultiLine,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { useCopy, useEmailLocale } from "../components/email-i18n"
import { storeLink } from "../../../lib/storefront-url"
import { CARRIER_DAMAGE_CUSTOMER_TEXTS } from "../../../lib/claims/constants"
import type { EmailLocale, Localized } from "../../../lib/email-locale"

interface RefundRequestEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** „reklamace" | „vraceni" | „odstoupeni" — řídí nadpis, text i lhůtu. */
  kind?: string | null;
  refundAmount?: string;
  /**
   * Reklamace: popis vady (povinný). Odstoupení / vrácení: důvod, jen když ho
   * zákazník napsal (nepovinný — volající výchozí větu neposílá).
   */
  refundReason?: string;
  /** Jen reklamace: co zákazník požaduje (výměna / vrácení peněz). */
  requestedResolution?: string;
  /** Vybrané položky — řádek za položku („název · varianta · N ks · částka"). */
  items?: string;
  /**
   * Balík dorazil poškozený (§11.3) — věta, že škodu s dopravcem řešíme my
   * a zákazník nic dalšího podávat nemusí (14. 10. 2026, právní audit §4.1).
   */
  carrierDamage?: boolean;
  /** Poškozený kus (§13.7) — fotky jsou přiložené k žádosti. */
  damagedItem?: boolean;
  orderLink?: string;
  /** Stav žádosti ve storefrontu (podepsaný odkaz z e-mailu). */
  claimsUrl?: string;
  /** „nejpozději do 14. 11. 2026 (30 dnů od uplatnění reklamace)" apod. */
  deadlineText?: string;
  estimatedProcessingTime?: string;
  /** Odkaz na PDF reklamační protokol (zákonné potvrzení o uplatnění). */
  protocolUrl?: string;
  /**
   * Datum a čas odeslání žádosti, už naformátované v Europe/Prague
   * („15. 10. 2026 v 14:32"). U reklamace = okamžik uplatnění (§ 19 odst. 1
   * ZOS), u odstoupení online povinná součást potvrzení (NV 29/2023 pokyn [4]).
   */
  submittedAt?: string;
  /** Kudy žádost přišla („online na webu obchodu"). */
  submittedChannel?: string;
  /** Odstoupení / vrácení: datum objednání („3. 10. 2026"). */
  orderDate?: string;
  /** Odstoupení / vrácení: převzetí zboží slovy (datum, osobní odběr, odhad…). */
  takeoverText?: string;
  /** Odstoupení: zakázkové položky vyjmuté z odstoupení (§ 1837 písm. d). */
  excludedItems?: string;
  /** Odstoupení od CELÉ smlouvy (→ vracíme i náklady na dodání). */
  wholeOrder?: boolean;
  /** Zboží už odešlo → zákazník ho vrací; jinak nic neposílá. */
  goodsShipped?: boolean;
  /** Kam zboží vrátit („Lucie Polanská, Putim 229, 397 01 Písek"). */
  returnAddress?: string;
  /** Jak se peníze vrátí (karta / převod na zamaskovaný účet / není co vracet). */
  refundMethodText?: string;
  /** §13.1 — server objednávku rovnou zrušil (nezaplaceno, neodesláno). */
  autoCancelled?: boolean;
  /** Nic nebylo zaplaceno → v „co bude dál" se o vracení peněz nemluví. */
  nothingToRefund?: boolean;
}

type KindCopy = {
  eyebrow: string
  h1: string
  accent: string
  preview: (order: string) => string
  intro: string
  submittedLabel: string
  reasonLabel: string
  deadlineLabel: string
  note: string
}

/**
 * Texty podle druhu (docs/reklamace-a-zruseni.md §6) a jazyka zákazníka
 * (lib/email-locale). Výchozí větev (`fallback`) je „vrácení peněz" — tak se
 * chovaly staré žádosti bez druhu.
 */
const KINDS: Localized<Record<"reklamace" | "vraceni" | "odstoupeni" | "fallback", KindCopy>> = {
  cs: {
    reklamace: {
      eyebrow: "Reklamace",
      h1: "Reklamaci jsem",
      accent: "přijala.",
      preview: (order) => `Reklamaci k objednávce ${order} jsem přijala.`,
      intro:
        "vaši reklamaci jsem přijala a začínám ji posuzovat. Mrzí mě, že vám kousek dělá starosti. Tento e-mail je písemným potvrzením o jejím uplatnění — níže najdete, kdy jste ji uplatnili, čeho se týká a co požadujete.",
      submittedLabel: "Uplatněno",
      reasonLabel: "Popis vady",
      deadlineLabel: "Vyřídím",
      note: "Reklamaci vyřídím bez zbytečného odkladu, nejpozději do 30 dnů od jejího uplatnění. O výsledku vám dám vědět e-mailem.",
    },
    vraceni: {
      eyebrow: "Vrácení zboží",
      h1: "Žádost o vrácení",
      accent: "jsem přijala.",
      preview: (order) => `Žádost o vrácení zboží k objednávce ${order} jsem přijala.`,
      intro:
        "vaši žádost o vrácení zboží jsem přijala. Jakmile ji posoudím, pošlu vám pokyny, kam zboží poslat.",
      submittedLabel: "Odesláno",
      reasonLabel: "Důvod",
      deadlineLabel: "Peníze vrátím",
      note: "Peníze vrátím do 14 dnů; smím počkat, než se ke mně zboží vrátí, nebo než mi prokážete, že jste ho odeslali.",
    },
    odstoupeni: {
      eyebrow: "Odstoupení od smlouvy",
      h1: "Potvrzuji přijetí",
      accent: "odstoupení.",
      preview: (order) =>
        `Potvrzuji přijetí vašeho odstoupení od smlouvy k objednávce ${order}.`,
      intro:
        "potvrzuji přijetí vašeho odstoupení od kupní smlouvy. Níže je celý obsah prohlášení, jak jsem ho od vás přijala, včetně data a času jeho odeslání.",
      submittedLabel: "Odesláno",
      reasonLabel: "Důvod",
      deadlineLabel: "Peníze vrátím",
      note: "",
    },
    fallback: {
      eyebrow: "Vrácení peněz",
      h1: "Žádost jsem",
      accent: "přijala.",
      preview: (order) => `Žádost o vrácení peněz k objednávce ${order} jsem přijala.`,
      intro: "vaši žádost o vrácení peněz jsem přijala a začínám ji vyřizovat.",
      submittedLabel: "Odesláno",
      reasonLabel: "Důvod",
      deadlineLabel: "Doba vyřízení",
      note: "Žádost je u mě — pracuji na ní a o vyřízení vám dám vědět.",
    },
  },
  sk: {
    reklamace: {
      eyebrow: "Reklamácia",
      h1: "Reklamáciu som",
      accent: "prijala.",
      preview: (order) => `Reklamáciu k objednávke ${order} som prijala.`,
      intro:
        "vašu reklamáciu som prijala a začínam ju posudzovať. Mrzí ma, že vám kúsok robí starosti. Tento e-mail je písomným potvrdením o jej uplatnení — nižšie nájdete, kedy ste ju uplatnili, čoho sa týka a čo požadujete.",
      submittedLabel: "Uplatnené",
      reasonLabel: "Popis vady",
      deadlineLabel: "Vybavím",
      note: "Reklamáciu vybavím bez zbytočného odkladu, najneskôr do 30 dní od jej uplatnenia. O výsledku vám dám vedieť e-mailom.",
    },
    vraceni: {
      eyebrow: "Vrátenie tovaru",
      h1: "Žiadosť o vrátenie",
      accent: "som prijala.",
      preview: (order) => `Žiadosť o vrátenie tovaru k objednávke ${order} som prijala.`,
      intro:
        "vašu žiadosť o vrátenie tovaru som prijala. Hneď ako ju posúdim, pošlem vám pokyny, kam tovar poslať.",
      submittedLabel: "Odoslané",
      reasonLabel: "Dôvod",
      deadlineLabel: "Peniaze vrátim",
      note: "Peniaze vrátim do 14 dní; môžem počkať, kým sa ku mne tovar vráti, alebo kým mi preukážete, že ste ho odoslali.",
    },
    odstoupeni: {
      eyebrow: "Odstúpenie od zmluvy",
      h1: "Potvrdzujem prijatie",
      accent: "odstúpenia.",
      preview: (order) =>
        `Potvrdzujem prijatie vášho odstúpenia od zmluvy k objednávke ${order}.`,
      intro:
        "potvrdzujem prijatie vášho odstúpenia od kúpnej zmluvy. Nižšie je celý obsah vyhlásenia, ako som ho od vás prijala, vrátane dátumu a času jeho odoslania.",
      submittedLabel: "Odoslané",
      reasonLabel: "Dôvod",
      deadlineLabel: "Peniaze vrátim",
      note: "",
    },
    fallback: {
      eyebrow: "Vrátenie peňazí",
      h1: "Žiadosť som",
      accent: "prijala.",
      preview: (order) => `Žiadosť o vrátenie peňazí k objednávke ${order} som prijala.`,
      intro: "vašu žiadosť o vrátenie peňazí som prijala a začínam ju vybavovať.",
      submittedLabel: "Odoslané",
      reasonLabel: "Dôvod",
      deadlineLabel: "Doba vybavenia",
      note: "Žiadosť je u mňa — pracujem na nej a o vybavení vám dám vedieť.",
    },
  },
  pl: {
    reklamace: {
      eyebrow: "Reklamacja",
      h1: "Reklamację",
      accent: "przyjęłam.",
      preview: (order) => `Przyjęłam reklamację do zamówienia ${order}.`,
      intro:
        "Przyjęłam Państwa reklamację i zaczynam ją rozpatrywać. Przykro mi, że egzemplarz sprawia kłopot. Ten e-mail jest pisemnym potwierdzeniem jej złożenia — poniżej znajdą Państwo datę złożenia, czego dotyczy i czego Państwo żądają.",
      submittedLabel: "Złożono",
      reasonLabel: "Opis wady",
      deadlineLabel: "Rozpatrzę",
      note: "Reklamację rozpatrzę bez zbędnej zwłoki, najpóźniej w ciągu 30 dni od jej złożenia. O wyniku poinformuję Państwa e-mailem.",
    },
    vraceni: {
      eyebrow: "Zwrot towaru",
      h1: "Wniosek o zwrot",
      accent: "przyjęłam.",
      preview: (order) => `Przyjęłam wniosek o zwrot towaru do zamówienia ${order}.`,
      intro:
        "Przyjęłam Państwa wniosek o zwrot towaru. Gdy tylko go rozpatrzę, wyślę wskazówki, dokąd towar odesłać.",
      submittedLabel: "Wysłano",
      reasonLabel: "Powód",
      deadlineLabel: "Zwrot pieniędzy",
      note: "Pieniądze zwrócę w ciągu 14 dni; mogę wstrzymać się ze zwrotem do chwili otrzymania towaru albo dowodu jego odesłania.",
    },
    odstoupeni: {
      eyebrow: "Odstąpienie od umowy",
      h1: "Potwierdzam otrzymanie",
      accent: "odstąpienia.",
      preview: (order) =>
        `Potwierdzam otrzymanie odstąpienia od umowy do zamówienia ${order}.`,
      intro:
        "Potwierdzam otrzymanie Państwa odstąpienia od umowy sprzedaży. Poniżej jest pełna treść oświadczenia w takiej postaci, w jakiej je otrzymałam, wraz z datą i godziną jego wysłania.",
      submittedLabel: "Wysłano",
      reasonLabel: "Powód",
      deadlineLabel: "Zwrot pieniędzy",
      note: "",
    },
    fallback: {
      eyebrow: "Zwrot pieniędzy",
      h1: "Wniosek",
      accent: "przyjęty.",
      preview: (order) => `Przyjęłam wniosek o zwrot pieniędzy do zamówienia ${order}.`,
      intro: "Przyjęłam Państwa wniosek o zwrot pieniędzy i zaczynam się nim zajmować.",
      submittedLabel: "Wysłano",
      reasonLabel: "Powód",
      deadlineLabel: "Czas rozpatrzenia",
      note: "Wniosek jest u mnie — zajmuję się nim i dam znać, gdy będzie załatwiony.",
    },
  },
  de: {
    reklamace: {
      eyebrow: "Reklamation",
      h1: "Ihre Reklamation",
      accent: "ist eingegangen.",
      preview: (order) => `Ihre Reklamation zur Bestellung ${order} ist bei mir eingegangen.`,
      intro:
        "Ihre Reklamation ist bei mir eingegangen, und ich beginne mit der Prüfung. Es tut mir leid, dass Ihnen das Stück Ärger macht. Diese E-Mail ist die schriftliche Bestätigung Ihrer Reklamation – unten finden Sie, wann Sie sie eingereicht haben, worauf sie sich bezieht und was Sie verlangen.",
      submittedLabel: "Eingereicht",
      reasonLabel: "Beschreibung des Mangels",
      deadlineLabel: "Erledigung",
      note: "Ich bearbeite Ihre Reklamation ohne unnötige Verzögerung, spätestens innerhalb von 30 Tagen nach Eingang. Über das Ergebnis informiere ich Sie per E-Mail.",
    },
    vraceni: {
      eyebrow: "Rücksendung",
      h1: "Ihre Rücksendeanfrage",
      accent: "ist eingegangen.",
      preview: (order) =>
        `Ihre Anfrage zur Rücksendung der Ware zur Bestellung ${order} ist bei mir eingegangen.`,
      intro:
        "Ihre Anfrage zur Rücksendung der Ware ist bei mir eingegangen. Sobald ich sie geprüft habe, schicke ich Ihnen Hinweise, wohin Sie die Ware senden.",
      submittedLabel: "Gesendet",
      reasonLabel: "Grund",
      deadlineLabel: "Erstattung",
      note: "Den Betrag erstatte ich innerhalb von 14 Tagen; ich darf damit warten, bis die Ware bei mir ist oder Sie mir die Rücksendung nachweisen.",
    },
    odstoupeni: {
      eyebrow: "Widerruf",
      h1: "Ich bestätige",
      accent: "Ihren Widerruf.",
      preview: (order) => `Ich bestätige den Eingang Ihres Widerrufs zur Bestellung ${order}.`,
      intro:
        "ich bestätige den Eingang Ihres Widerrufs des Kaufvertrags. Unten finden Sie den vollständigen Inhalt Ihrer Erklärung, so wie ich sie erhalten habe, einschließlich Datum und Uhrzeit der Absendung.",
      submittedLabel: "Gesendet",
      reasonLabel: "Grund",
      deadlineLabel: "Erstattung",
      note: "",
    },
    fallback: {
      eyebrow: "Erstattung",
      h1: "Ihre Anfrage",
      accent: "ist eingegangen.",
      preview: (order) => `Ihre Erstattungsanfrage zur Bestellung ${order} ist bei mir eingegangen.`,
      intro: "Ihre Erstattungsanfrage ist bei mir eingegangen, und ich kümmere mich darum.",
      submittedLabel: "Gesendet",
      reasonLabel: "Grund",
      deadlineLabel: "Bearbeitungszeit",
      note: "Ihre Anfrage liegt bei mir – ich arbeite daran und melde mich, sobald alles erledigt ist.",
    },
  },
  en: {
    reklamace: {
      eyebrow: "Complaint",
      h1: "I've received",
      accent: "your complaint.",
      preview: (order) => `I've received your complaint about order ${order}.`,
      intro:
        "I've received your complaint and I'm starting to look into it. I'm sorry the piece is causing you trouble. This e-mail is written confirmation that you've made the complaint — below you'll find when you made it, what it concerns and what you're asking for.",
      submittedLabel: "Made on",
      reasonLabel: "Description of the defect",
      deadlineLabel: "I'll settle it",
      note: "I'll settle your complaint without undue delay and within 30 days of it being made at the latest. I'll let you know the outcome by e-mail.",
    },
    vraceni: {
      eyebrow: "Return of goods",
      h1: "I've received",
      accent: "your return request.",
      preview: (order) => `I've received your request to return goods from order ${order}.`,
      intro:
        "I've received your request to return goods. As soon as I've looked at it, I'll send you instructions on where to send the goods.",
      submittedLabel: "Sent",
      reasonLabel: "Reason",
      deadlineLabel: "Refund",
      note: "I'll refund the money within 14 days; I may wait until the goods are back with me, or until you show me that you've sent them.",
    },
    odstoupeni: {
      eyebrow: "Withdrawal from the contract",
      h1: "I confirm receipt",
      accent: "of your withdrawal.",
      preview: (order) =>
        `I confirm receipt of your withdrawal from the contract for order ${order}.`,
      intro:
        "I confirm receipt of your withdrawal from the purchase contract. Below is the full content of your statement as I received it, including the date and time it was sent.",
      submittedLabel: "Sent",
      reasonLabel: "Reason",
      deadlineLabel: "Refund",
      note: "",
    },
    fallback: {
      eyebrow: "Refund",
      h1: "I've received",
      accent: "your request.",
      preview: (order) => `I've received your refund request for order ${order}.`,
      intro: "I've received your refund request and I'm starting to deal with it.",
      submittedLabel: "Sent",
      reasonLabel: "Reason",
      deadlineLabel: "Processing time",
      note: "Your request is with me — I'm working on it and will let you know once it's settled.",
    },
  },
}

/** Společné texty šablony (popisky řádků, tlačítka, „co bude dál"). */
const COPY: Localized<{
  defaultDeadline: string
  channel: string
  order: string
  orderDate: string
  takeover: string
  scope: string
  scopeWhole: string
  scopePartial: string
  withdrawnItems: string
  goods: string
  excluded: string
  cause: string
  carrierDamage: string
  damagedItem: string
  requested: string
  refundMethod: string
  refundAmount: string
  autoCancelled: string
  excludedNote: string
  protocolHint: string
  trackClaim: string
  protocol: string
  viewOrder: string
  downloadProtocol: string
  confirmLater: string
  sameWay: string
  contact: string
  nextLabel: string
  nothingToRefund: string
  refundWhole: string
  refundPartial: string
  notShippedWhole: string
  notShippedPartial: string
  step1: (address: React.ReactNode) => React.ReactNode
  step2Wait: string
  step3: string
}> = {
  cs: {
    defaultDeadline: "3–5 pracovních dnů",
    channel: "Způsob",
    order: "Objednávka",
    orderDate: "Datum objednání",
    takeover: "Převzetí zboží",
    scope: "Rozsah",
    scopeWhole: "odstoupení od celé smlouvy",
    scopePartial: "odstoupení jen od uvedeného zboží",
    withdrawnItems: "Odstupujete od",
    goods: "Zboží",
    excluded: "Vyjmuto (zakázka)",
    cause: "Příčina",
    carrierDamage: "Poškozeno přepravou",
    damagedItem: "Poškozený kus",
    requested: "Požadujete",
    refundMethod: "Vrácení peněz",
    refundAmount: "Částka k vrácení",
    autoCancelled:
      "Objednávka je zrušená. Nic jste nezaplatili a zboží jsem ještě neodeslala — nic mi neposílejte, není co vracet.",
    excludedNote:
      "Zboží vyrobené na zakázku podle vašeho zadání z odstoupení vyjímám — u něj zákon odstoupení nepřipouští (§ 1837 písm. d) občanského zákoníku). Má-li vadu, můžete ho samozřejmě reklamovat.",
    protocolHint:
      "Protokol o uplatnění reklamace se stejnými údaji si můžete stáhnout jako PDF — tlačítko je níže.",
    trackClaim: "Sledovat stav žádosti",
    protocol: "Protokol (PDF)",
    viewOrder: "Zobrazit objednávku",
    downloadProtocol: "Stáhnout protokol (PDF)",
    confirmLater: "Jakmile bude vše vyřízené, pošlu vám písemné potvrzení e-mailem.",
    sameWay: "Peníze vracím stejnou cestou, jakou ke mně platba přišla.",
    contact: "Kdyby cokoli, napište mi na info@keramickazahrada.cz — odpovídám sama.",
    nextLabel: "Co bude dál:",
    nothingToRefund: "Zatím jste nic nezaplatili, takže není co vracet.",
    refundWhole:
      "Peníze vrátím bez zbytečného odkladu, nejpozději do 14 dnů od odstoupení — kupní cenu i náklady na dodání ve výši nejlevnějšího způsobu dodání, který nabízím.",
    refundPartial:
      "Peníze za uvedené zboží vrátím bez zbytečného odkladu, nejpozději do 14 dnů od odstoupení.",
    notShippedWhole:
      "zboží jsem ještě neodeslala — objednávku zastavím a nic mi neposíláte.",
    notShippedPartial:
      "zboží jsem ještě neodeslala — uvedené kusy vám neposílám, zbytek objednávky pošlu jako obvykle.",
    step1: (address) => (
      <>
        1. Zboží mi prosím pošlete zpět nebo předejte nejpozději do 14 dnů od
        odstoupení na adresu <strong>{address}</strong>. Lhůta je
        zachovaná, když zásilku odešlete před jejím uplynutím. Keramika je
        křehká, tak ji prosím pečlivě zabalte, nejlépe do původního obalu;
        přímé náklady na vrácení zboží nesete vy.
      </>
    ),
    step2Wait:
      " Peníze smím vrátit až poté, co zboží dostanu zpět, nebo co mi prokážete, že jste ho odeslali — podle toho, co nastane dříve.",
    step3:
      "3. Odpovídáte jen za snížení hodnoty zboží, které vzniklo nakládáním s ním jinak, než je nutné k seznámení se s jeho povahou, vlastnostmi a funkčností.",
  },
  sk: {
    defaultDeadline: "3–5 pracovných dní",
    channel: "Spôsob",
    order: "Objednávka",
    orderDate: "Dátum objednania",
    takeover: "Prevzatie tovaru",
    scope: "Rozsah",
    scopeWhole: "odstúpenie od celej zmluvy",
    scopePartial: "odstúpenie len od uvedeného tovaru",
    withdrawnItems: "Odstupujete od",
    goods: "Tovar",
    excluded: "Vyňaté (zákazka)",
    cause: "Príčina",
    carrierDamage: "Poškodené pri preprave",
    damagedItem: "Poškodený kus",
    requested: "Požadujete",
    refundMethod: "Vrátenie peňazí",
    refundAmount: "Suma na vrátenie",
    autoCancelled:
      "Objednávka je zrušená. Nič ste nezaplatili a tovar som ešte neodoslala — nič mi neposielajte, nie je čo vracať.",
    excludedNote:
      "Tovar vyrobený na zákazku podľa vášho zadania z odstúpenia vynímam — pri ňom zákon odstúpenie nepripúšťa (§ 1837 písm. d) českého Občianskeho zákonníka a čl. 16 písm. c) smernice 2011/83/EÚ). Ak má vadu, môžete ho samozrejme reklamovať.",
    protocolHint:
      "Protokol o uplatnení reklamácie s rovnakými údajmi si môžete stiahnuť ako PDF — tlačidlo je nižšie.",
    trackClaim: "Sledovať stav žiadosti",
    protocol: "Protokol (PDF)",
    viewOrder: "Zobraziť objednávku",
    downloadProtocol: "Stiahnuť protokol (PDF)",
    confirmLater: "Hneď ako bude všetko vybavené, pošlem vám písomné potvrdenie e-mailom.",
    sameWay: "Peniaze vraciam rovnakou cestou, akou ku mne platba prišla.",
    contact: "Keby čokoľvek, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
    nextLabel: "Čo bude ďalej:",
    nothingToRefund: "Zatiaľ ste nič nezaplatili, takže nie je čo vracať.",
    refundWhole:
      "Peniaze vrátim bez zbytočného odkladu, najneskôr do 14 dní od odstúpenia — kúpnu cenu aj náklady na doručenie vo výške najlacnejšieho spôsobu doručenia, ktorý ponúkam.",
    refundPartial:
      "Peniaze za uvedený tovar vrátim bez zbytočného odkladu, najneskôr do 14 dní od odstúpenia.",
    notShippedWhole:
      "tovar som ešte neodoslala — objednávku zastavím a nič mi neposielate.",
    notShippedPartial:
      "tovar som ešte neodoslala — uvedené kusy vám neposielam, zvyšok objednávky pošlem ako obvykle.",
    step1: (address) => (
      <>
        1. Tovar mi, prosím, pošlite späť alebo odovzdajte najneskôr do 14 dní
        od odstúpenia na adresu <strong>{address}</strong>. Lehota je
        zachovaná, ak zásielku odošlete pred jej uplynutím. Keramika je krehká,
        preto ju, prosím, starostlivo zabaľte, najlepšie do pôvodného obalu;
        priame náklady na vrátenie tovaru znášate vy.
      </>
    ),
    step2Wait:
      " Peniaze smiem vrátiť až potom, čo tovar dostanem späť, alebo čo mi preukážete, že ste ho odoslali — podľa toho, čo nastane skôr.",
    step3:
      "3. Zodpovedáte len za zníženie hodnoty tovaru, ktoré vzniklo zaobchádzaním s ním inak, než je nutné na oboznámenie sa s jeho povahou, vlastnosťami a funkčnosťou.",
  },
  pl: {
    defaultDeadline: "3–5 dni roboczych",
    channel: "Sposób",
    order: "Zamówienie",
    orderDate: "Data zamówienia",
    takeover: "Odbiór towaru",
    scope: "Zakres",
    scopeWhole: "odstąpienie od całej umowy",
    scopePartial: "odstąpienie tylko w odniesieniu do wskazanego towaru",
    withdrawnItems: "Odstępują Państwo od",
    goods: "Towar",
    excluded: "Wyłączone (zamówienie indywidualne)",
    cause: "Przyczyna",
    carrierDamage: "Uszkodzone w transporcie",
    damagedItem: "Uszkodzony egzemplarz",
    requested: "Państwa żądanie",
    refundMethod: "Zwrot pieniędzy",
    refundAmount: "Kwota do zwrotu",
    autoCancelled:
      "Zamówienie zostało anulowane. Nic Państwo nie zapłacili, a towar nie został jeszcze wysłany — proszę niczego nie odsyłać, nie ma czego zwracać.",
    excludedNote:
      "Towar wykonany na zamówienie według Państwa wskazówek wyłączam z odstąpienia — w jego przypadku prawo nie przewiduje odstąpienia od umowy (§ 1837 lit. d) czeskiego kodeksu cywilnego oraz art. 16 lit. c) dyrektywy 2011/83/UE). Jeśli ma wadę, mogą go Państwo oczywiście reklamować.",
    protocolHint:
      "Protokół złożenia reklamacji z tymi samymi danymi mogą Państwo pobrać jako PDF — przycisk znajduje się poniżej.",
    trackClaim: "Sprawdź status zgłoszenia",
    protocol: "Protokół (PDF)",
    viewOrder: "Zobacz zamówienie",
    downloadProtocol: "Pobierz protokół (PDF)",
    confirmLater: "Gdy wszystko będzie załatwione, wyślę Państwu pisemne potwierdzenie e-mailem.",
    sameWay: "Pieniądze zwracam tą samą drogą, którą dotarła do mnie płatność.",
    contact: "W razie pytań proszę pisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    nextLabel: "Co dalej:",
    nothingToRefund: "Na razie nic Państwo nie zapłacili, więc nie ma czego zwracać.",
    refundWhole:
      "Pieniądze zwrócę niezwłocznie, najpóźniej w ciągu 14 dni od odstąpienia — cenę zakupu oraz koszty dostawy w wysokości najtańszego oferowanego przeze mnie sposobu dostawy.",
    refundPartial:
      "Pieniądze za wskazany towar zwrócę niezwłocznie, najpóźniej w ciągu 14 dni od odstąpienia.",
    notShippedWhole:
      "towar nie został jeszcze wysłany — wstrzymam zamówienie, a Państwo niczego nie odsyłają.",
    notShippedPartial:
      "towar nie został jeszcze wysłany — wskazanych egzemplarzy nie wyślę, resztę zamówienia wyślę jak zwykle.",
    step1: (address) => (
      <>
        1. Proszę odesłać lub przekazać mi towar najpóźniej w ciągu 14 dni od
        odstąpienia na adres <strong>{address}</strong>. Termin jest
        zachowany, jeśli przesyłka zostanie nadana przed jego upływem.
        Ceramika jest delikatna, dlatego proszę ją starannie zapakować,
        najlepiej w oryginalne opakowanie; bezpośrednie koszty zwrotu towaru
        ponoszą Państwo.
      </>
    ),
    step2Wait:
      " Mogę wstrzymać się ze zwrotem pieniędzy do chwili otrzymania towaru albo dowodu jego odesłania — w zależności od tego, co nastąpi wcześniej.",
    step3:
      "3. Odpowiadają Państwo wyłącznie za zmniejszenie wartości towaru wynikające z korzystania z niego w sposób wykraczający poza konieczny do stwierdzenia jego charakteru, cech i funkcjonowania.",
  },
  de: {
    defaultDeadline: "3–5 Werktage",
    channel: "Weg",
    order: "Bestellung",
    orderDate: "Bestelldatum",
    takeover: "Erhalt der Ware",
    scope: "Umfang",
    scopeWhole: "Widerruf des gesamten Vertrags",
    scopePartial: "Widerruf nur für die genannte Ware",
    withdrawnItems: "Widerruf für",
    goods: "Ware",
    excluded: "Ausgenommen (Auftragsarbeit)",
    cause: "Ursache",
    carrierDamage: "Transportschaden",
    damagedItem: "Beschädigtes Stück",
    requested: "Ihr Wunsch",
    refundMethod: "Erstattung",
    refundAmount: "Erstattungsbetrag",
    autoCancelled:
      "Die Bestellung ist storniert. Sie haben nichts bezahlt, und ich habe die Ware noch nicht versandt – bitte schicken Sie mir nichts, es gibt nichts zurückzugeben.",
    excludedNote:
      "Ware, die nach Ihren Vorgaben als Auftragsarbeit angefertigt wurde, nehme ich vom Widerruf aus – dafür sieht das Gesetz kein Widerrufsrecht vor (§ 1837 Buchst. d des tschechischen Bürgerlichen Gesetzbuchs und Art. 16 Buchst. c der Richtlinie 2011/83/EU). Hat sie einen Mangel, können Sie sie selbstverständlich reklamieren.",
    protocolHint:
      "Das Protokoll über Ihre Reklamation mit denselben Angaben können Sie als PDF herunterladen – die Schaltfläche finden Sie unten.",
    trackClaim: "Status der Anfrage ansehen",
    protocol: "Protokoll (PDF)",
    viewOrder: "Bestellung ansehen",
    downloadProtocol: "Protokoll herunterladen (PDF)",
    confirmLater: "Sobald alles erledigt ist, schicke ich Ihnen eine schriftliche Bestätigung per E-Mail.",
    sameWay: "Den Betrag erstatte ich auf demselben Weg, auf dem Ihre Zahlung bei mir eingegangen ist.",
    contact: "Bei Fragen schreiben Sie mir an info@keramickazahrada.cz – ich antworte selbst.",
    nextLabel: "Wie es weitergeht:",
    nothingToRefund: "Sie haben bisher nichts bezahlt, es gibt also nichts zu erstatten.",
    refundWhole:
      "Ich erstatte den Betrag unverzüglich, spätestens innerhalb von 14 Tagen nach dem Widerruf – den Kaufpreis und die Lieferkosten in Höhe der günstigsten von mir angebotenen Versandart.",
    refundPartial:
      "Den Betrag für die genannte Ware erstatte ich unverzüglich, spätestens innerhalb von 14 Tagen nach dem Widerruf.",
    notShippedWhole:
      "die Ware habe ich noch nicht versandt – ich stoppe die Bestellung, und Sie müssen nichts zurückschicken.",
    notShippedPartial:
      "die Ware habe ich noch nicht versandt – die genannten Stücke schicke ich nicht, den Rest der Bestellung versende ich wie gewohnt.",
    step1: (address) => (
      <>
        1. Bitte schicken Sie mir die Ware spätestens 14 Tage nach dem Widerruf
        an <strong>{address}</strong> zurück oder übergeben Sie sie mir dort.
        Die Frist ist gewahrt, wenn Sie die Ware vor ihrem Ablauf absenden.
        Keramik ist zerbrechlich – verpacken Sie sie bitte sorgfältig, am
        besten in der Originalverpackung; die unmittelbaren Kosten der
        Rücksendung tragen Sie.
      </>
    ),
    step2Wait:
      " Ich darf die Erstattung verweigern, bis ich die Ware zurückerhalten habe oder Sie nachgewiesen haben, dass Sie sie zurückgesandt haben – je nachdem, was früher eintritt.",
    step3:
      "3. Sie müssen für einen etwaigen Wertverlust der Ware nur aufkommen, wenn dieser auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise nicht notwendigen Umgang mit ihr zurückzuführen ist.",
  },
  en: {
    defaultDeadline: "3–5 working days",
    channel: "Submitted",
    order: "Order",
    orderDate: "Order date",
    takeover: "Goods received",
    scope: "Scope",
    scopeWhole: "withdrawal from the whole contract",
    scopePartial: "withdrawal from the listed goods only",
    withdrawnItems: "You are withdrawing from",
    goods: "Goods",
    excluded: "Excluded (commission)",
    cause: "Cause",
    carrierDamage: "Damaged in transit",
    damagedItem: "Damaged piece",
    requested: "You are asking for",
    refundMethod: "Refund",
    refundAmount: "Amount to refund",
    autoCancelled:
      "The order has been cancelled. You haven't paid anything and I haven't sent the goods yet — please don't send me anything; there's nothing to return.",
    excludedNote:
      "Goods made to your specifications as a commission are excluded from the withdrawal — the law does not allow withdrawal for them (Section 1837(d) of the Czech Civil Code and Article 16(c) of Directive 2011/83/EU). If such a piece has a defect, you can of course make a complaint.",
    protocolHint:
      "You can download a record of your complaint with the same details as a PDF — the button is below.",
    trackClaim: "Check the status of your request",
    protocol: "Record (PDF)",
    viewOrder: "View order",
    downloadProtocol: "Download the record (PDF)",
    confirmLater: "Once everything is settled, I'll send you written confirmation by e-mail.",
    sameWay: "I refund money the same way your payment reached me.",
    contact: "If anything comes up, write to me at info@keramickazahrada.cz — I answer every message myself.",
    nextLabel: "What happens next:",
    nothingToRefund: "You haven't paid anything yet, so there's nothing to refund.",
    refundWhole:
      "I'll refund the money without undue delay and within 14 days of your withdrawal at the latest — the purchase price as well as delivery costs up to the cheapest delivery option I offer.",
    refundPartial:
      "I'll refund the money for the listed goods without undue delay and within 14 days of your withdrawal at the latest.",
    notShippedWhole:
      "I haven't sent the goods yet — I'll stop the order, and you don't need to send anything back.",
    notShippedPartial:
      "I haven't sent the goods yet — I won't send you the listed pieces, and the rest of the order will go out as usual.",
    step1: (address) => (
      <>
        1. Please send the goods back to me, or hand them over, at{" "}
        <strong>{address}</strong> no later than 14 days after your
        withdrawal. The deadline is met if you send the parcel before it runs
        out. Ceramics are fragile, so please pack them carefully, ideally in
        the original packaging; you bear the direct cost of returning the
        goods.
      </>
    ),
    step2Wait:
      " I may withhold the refund until I have received the goods back or you have shown me that you've sent them, whichever happens first.",
    step3:
      "3. You are only liable for any loss in value of the goods resulting from handling them beyond what is necessary to establish their nature, characteristics and functioning.",
  },
}

/** „Co teď" po odstoupení — podle toho, zda zboží odešlo a zda jde o celou smlouvu. */
const WithdrawalNextSteps = ({
  goodsShipped,
  wholeOrder,
  returnAddress,
  autoCancelled,
  nothingToRefund,
}: {
  goodsShipped: boolean
  wholeOrder: boolean
  returnAddress: string
  autoCancelled: boolean
  nothingToRefund: boolean
}) => {
  const t = useCopy(COPY)
  if (autoCancelled) {
    return <Note tone="olive">{t.autoCancelled}</Note>
  }
  const refundSentence = nothingToRefund
    ? t.nothingToRefund
    : wholeOrder
      ? t.refundWhole
      : t.refundPartial
  if (!goodsShipped) {
    return (
      <>
        <P>
          <strong>{t.nextLabel}</strong>{" "}
          {wholeOrder ? t.notShippedWhole : t.notShippedPartial}{" "}
          {refundSentence}
        </P>
      </>
    )
  }
  return (
    <>
      <P>
        <strong>{t.nextLabel}</strong>
      </P>
      <P>{t.step1(returnAddress)}</P>
      <P>
        2. {refundSentence}
        {nothingToRefund ? "" : t.step2Wait}
      </P>
      <P>{t.step3}</P>
    </>
  )
}

/**
 * Potvrzení přijetí žádosti (reklamace / vrácení / odstoupení).
 *
 * - Odstoupení online (§ 1830a OZ): potvrzení „v textové podobě, včetně jeho
 *   obsahu a data a času jeho odeslání" (NV 29/2023 Sb., pokyn [4]) — zboží,
 *   rozsah, vyjmutá zakázka, důvod, způsob vrácení peněz, datum a čas, a co
 *   bude dál (vrácení zboží, lhůty, § 1832 a § 1833 OZ).
 * - Reklamace (§ 19 odst. 1 ZOS): datum a čas uplatnění, obsah (zboží, popis
 *   vady), požadovaný způsob vyřízení a 30denní lhůta od uplatnění.
 *
 * Částka se vykreslí jen s reálnou hodnotou — při přijetí žádosti ještě žádná
 * rozhodnutá není a vymyšlená výchozí částka by v ostrém e-mailu slibovala
 * konkrétní peníze.
 *
 * Texty jsou v jazyce zákazníka (`KINDS`, `COPY`); hodnoty v řádcích skládá
 * odesílatel ve stejném jazyce (lib/claims/email-copy).
 */
function RefundRequestEmailComponent({
  customerName,
  orderNumber = "",
  kind,
  refundAmount,
  refundReason,
  requestedResolution,
  items,
  carrierDamage = false,
  damagedItem = false,
  orderLink = "",
  claimsUrl,
  deadlineText,
  estimatedProcessingTime,
  protocolUrl,
  submittedAt,
  submittedChannel,
  orderDate,
  takeoverText,
  excludedItems,
  wholeOrder = false,
  goodsShipped = false,
  returnAddress,
  refundMethodText,
  autoCancelled = false,
  nothingToRefund = false,
}: RefundRequestEmailProps) {
  const t = useCopy(COPY)
  const kinds = useCopy(KINDS)
  const carrierDamageText = useCopy(CARRIER_DAMAGE_CUSTOMER_TEXTS)
  const copy =
    (kind === "reklamace" || kind === "vraceni" || kind === "odstoupeni"
      ? kinds[kind]
      : null) ?? kinds.fallback
  const orderUrl = orderLink || storeLink()
  const deadline = deadlineText || estimatedProcessingTime || t.defaultDeadline
  const isWithdrawal = kind === "odstoupeni"
  const isClaim = kind === "reklamace"
  return (
    <EmailLayout preview={copy.preview(orderNumber)}>
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <EmailH1 accent={copy.accent}>{copy.h1}</EmailH1>

      <Greeting name={customerName} />
      <P>{copy.intro}</P>

      {submittedAt ? (
        <LedgerRow label={copy.submittedLabel} value={submittedAt} strong />
      ) : null}
      {submittedAt && submittedChannel ? (
        <LedgerRow label={t.channel} value={submittedChannel} />
      ) : null}
      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {orderDate ? <LedgerRow label={t.orderDate} value={orderDate} /> : null}
      {takeoverText ? <LedgerRow label={t.takeover} value={takeoverText} /> : null}
      {isWithdrawal ? (
        <LedgerRow label={t.scope} value={wholeOrder ? t.scopeWhole : t.scopePartial} />
      ) : null}
      {items ? (
        <LedgerRow
          label={isWithdrawal ? t.withdrawnItems : t.goods}
          value={<MultiLine value={items} />}
        />
      ) : null}
      {excludedItems ? (
        <LedgerRow
          label={t.excluded}
          value={<MultiLine value={excludedItems} />}
          tone="clay"
        />
      ) : null}
      {refundReason ? <LedgerRow label={copy.reasonLabel} value={refundReason} /> : null}
      {carrierDamage ? (
        <LedgerRow label={t.cause} value={t.carrierDamage} tone="clay" />
      ) : null}
      {damagedItem ? (
        <LedgerRow label={t.cause} value={t.damagedItem} tone="clay" />
      ) : null}
      {requestedResolution ? (
        <LedgerRow label={t.requested} value={requestedResolution} />
      ) : null}
      {refundMethodText ? (
        <LedgerRow label={t.refundMethod} value={refundMethodText} />
      ) : null}
      {autoCancelled ? null : <LedgerRow label={copy.deadlineLabel} value={deadline} />}
      {refundAmount ? (
        <LedgerRow label={t.refundAmount} value={refundAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      {isWithdrawal ? (
        <WithdrawalNextSteps
          goodsShipped={goodsShipped}
          wholeOrder={wholeOrder}
          returnAddress={returnAddress || "Lucie Polanská, Putim 229, 397 01 Písek"}
          autoCancelled={autoCancelled}
          nothingToRefund={nothingToRefund}
        />
      ) : autoCancelled ? (
        <Note tone="olive">{t.autoCancelled}</Note>
      ) : (
        <Note tone="olive">{copy.note}</Note>
      )}

      {excludedItems ? <Note tone="clay">{t.excludedNote}</Note> : null}

      {carrierDamage ? <Note tone="clay">{carrierDamageText}</Note> : null}

      {isClaim && protocolUrl ? <P small>{t.protocolHint}</P> : null}

      {claimsUrl ? (
        <ButtonRow>
          <EmailButton href={claimsUrl}>{t.trackClaim}</EmailButton>
          {protocolUrl ? (
            <>
              <span style={{ display: "inline-block", width: "12px" }} />
              <EmailButton href={protocolUrl} variant="ghost">
                {t.protocol}
              </EmailButton>
            </>
          ) : null}
        </ButtonRow>
      ) : (
        <>
          {orderUrl ? (
            <ButtonRow>
              <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
            </ButtonRow>
          ) : null}
          {protocolUrl ? (
            <ButtonRow>
              <EmailButton href={protocolUrl}>{t.downloadProtocol}</EmailButton>
            </ButtonRow>
          ) : null}
        </>
      )}

      <P small>
        {refundMethodText ? t.confirmLater : `${t.sameWay} ${t.confirmLater}`}{" "}
        {t.contact}
      </P>
      <Signature />
    </EmailLayout>
  )
}

export const RefundRequestEmail = (props: RefundRequestEmailProps) => (
  <RefundRequestEmailComponent {...props} />
)

// Mock data for preview/development — hodnoty řádků skládá odesílatel
// v jazyce zákazníka, proto i náhled po jazycích.
const mockRefundRequest: Localized<RefundRequestEmailProps> = {
  cs: {
    customerName: "Jan Novák",
    orderNumber: "#12345",
    kind: "odstoupeni",
    submittedAt: "15. 10. 2026 v 14:32",
    submittedChannel: "online na webu obchodu",
    orderDate: "3. 10. 2026",
    takeoverText: "7. 10. 2026",
    items: "Zahradní mísa · Ø 32 cm · 1 ks · 1 305 Kč",
    wholeOrder: true,
    goodsShipped: true,
    returnAddress: "Lucie Polanská, Putim 229, 397 01 Písek",
    refundMethodText:
      "Stejným platebním prostředkem, jakým jste platili — vrátím je stejnou cestou (přes ComGate).",
    deadlineText: "nejpozději do 29. 10. 2026 (14 dnů od odstoupení)",
    orderLink: "https://keramickazahrada.cz/orders/12345",
    claimsUrl: "https://keramickazahrada.cz/cz/order/order_12345/claims?token=abc",
  },
  sk: {
    customerName: "Ján Novák",
    orderNumber: "#12345",
    kind: "odstoupeni",
    submittedAt: "15. 10. 2026 o 14:32",
    submittedChannel: "online na webe obchodu",
    orderDate: "3. 10. 2026",
    takeoverText: "7. 10. 2026",
    items: "Záhradná misa · Ø 32 cm · 1 ks · 52,90 €",
    wholeOrder: true,
    goodsShipped: true,
    returnAddress: "Lucie Polanská, Putim 229, 397 01 Písek",
    refundMethodText:
      "Rovnakým platobným prostriedkom, akým ste platili — vrátim ich rovnakou cestou (cez ComGate).",
    deadlineText: "najneskôr do 29. 10. 2026 (14 dní od odstúpenia)",
    orderLink: "https://keramickazahrada.cz/sk/orders/12345",
    claimsUrl: "https://keramickazahrada.cz/sk/order/order_12345/claims?token=abc",
  },
  pl: {
    customerName: "Anna Nowak",
    orderNumber: "#12345",
    kind: "odstoupeni",
    submittedAt: "15.10.2026, godz. 14:32",
    submittedChannel: "online przez stronę sklepu",
    orderDate: "3.10.2026",
    takeoverText: "7.10.2026",
    items: "Misa ogrodowa · Ø 32 cm · 1 szt. · 229,00 zł",
    wholeOrder: true,
    goodsShipped: true,
    returnAddress: "Lucie Polanská, Putim 229, 397 01 Písek",
    refundMethodText:
      "Tym samym środkiem płatności, którym Państwo zapłacili — zwrócę je tą samą drogą (przez ComGate).",
    deadlineText: "najpóźniej do 29.10.2026 (14 dni od odstąpienia)",
    orderLink: "https://keramickazahrada.cz/pl/orders/12345",
    claimsUrl: "https://keramickazahrada.cz/pl/order/order_12345/claims?token=abc",
  },
  de: {
    customerName: "Jana Neumann",
    orderNumber: "#12345",
    kind: "odstoupeni",
    submittedAt: "15.10.2026 um 14:32 Uhr",
    submittedChannel: "online über die Website des Shops",
    orderDate: "3.10.2026",
    takeoverText: "7.10.2026",
    items: "Gartenschale · Ø 32 cm · 1 Stk. · 52,90 €",
    wholeOrder: true,
    goodsShipped: true,
    returnAddress: "Lucie Polanská, Putim 229, 397 01 Písek",
    refundMethodText:
      "Über dasselbe Zahlungsmittel, mit dem Sie bezahlt haben – ich erstatte den Betrag auf demselben Weg (über ComGate).",
    deadlineText: "spätestens bis 29.10.2026 (14 Tage nach dem Widerruf)",
    orderLink: "https://keramickazahrada.cz/de/orders/12345",
    claimsUrl: "https://keramickazahrada.cz/de/order/order_12345/claims?token=abc",
  },
  en: {
    customerName: "Emma Clarke",
    orderNumber: "#12345",
    kind: "odstoupeni",
    submittedAt: "15 October 2026 at 14:32",
    submittedChannel: "online via the shop's website",
    orderDate: "3 October 2026",
    takeoverText: "7 October 2026",
    items: "Garden bowl · Ø 32 cm · 1 pcs · €52.90",
    wholeOrder: true,
    goodsShipped: true,
    returnAddress: "Lucie Polanská, Putim 229, 397 01 Písek",
    refundMethodText:
      "Using the same payment method you paid with — I will send it back the same way (via ComGate).",
    deadlineText: "by 29 October 2026 at the latest (14 days from your withdrawal)",
    orderLink: "https://keramickazahrada.cz/cz/orders/12345",
    claimsUrl: "https://keramickazahrada.cz/cz/order/order_12345/claims?token=abc",
  },
}

const RefundRequestPreview = () => {
  const locale: EmailLocale = useEmailLocale()
  return <RefundRequestEmailComponent {...mockRefundRequest[locale]} />
}

export default () => <RefundRequestPreview />
