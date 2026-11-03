import type * as React from "react"
import {
  ButtonRow,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

interface SurchargeConfirmedEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** Příplatek (naformátovaný) — částka navíc nad původní cenu. */
  surchargeAmount?: string;
  /** Kolik po připočtení příplatku zbývá doplatit (naformátované). */
  newBalance?: string;
  /** Poznámka majitelky — na čem jste se domluvili (volitelná, jde, jak ji napsala). */
  reason?: string;
  orderLink?: string;
  /** Název položky zakázky — u objednávky s víc zakázkami říká, které se příplatek týká. */
  productTitle?: string | null;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: (orderNumber: string, productTitle: string) => string
  order: string
  product: string
  surcharge: string
  balance: string
  invoice: string
  disagree: (email: React.ReactNode, phone: React.ReactNode) => React.ReactNode
  viewOrder: string
}> = {
  cs: {
    preview: (n) => `Příplatek k zakázce ${n}, jak jsme se domluvili — písemně.`,
    eyebrow: "Zakázka",
    title: "Příplatek",
    accent: "jak jsme se domluvili.",
    intro: (n, title) =>
      `potvrzuji, že k vaší zakázce${n ? ` ${n}` : ""}${title ? ` (${title})` : ""} přibyl příplatek, na kterém jsme se spolu domluvili — po telefonu, e-mailem nebo zprávou. Tímto e-mailem vám ho jen písemně potvrzuji, ať to máte černé na bílém.`,
    order: "Objednávka",
    product: "Výrobek",
    surcharge: "Příplatek",
    balance: "Zbývá doplatit",
    invoice:
      "Příplatek je součástí doplatku, který vám pošlu k zaplacení zvlášť — na faktuře ho uvidíte jako samostatnou položku.",
    disagree: (email, phone) => (
      <>
        Kdybyste s příplatkem nesouhlasili nebo si nebyli čímkoli jistí, napište mi na {email}{" "}
        nebo zavolejte na {phone}. Ráda to s vámi proberu.
      </>
    ),
    viewOrder: "Zobrazit objednávku",
  },
  sk: {
    preview: (n) => `Príplatok k zákazke ${n}, ako sme sa dohodli — písomne.`,
    eyebrow: "Zákazka",
    title: "Príplatok",
    accent: "ako sme sa dohodli.",
    intro: (n, title) =>
      `potvrdzujem, že k vašej zákazke${n ? ` ${n}` : ""}${title ? ` (${title})` : ""} pribudol príplatok, na ktorom sme sa spolu dohodli — telefonicky, e-mailom alebo správou. Týmto e-mailom vám ho len písomne potvrdzujem, aby ste to mali čierne na bielom.`,
    order: "Objednávka",
    product: "Výrobok",
    surcharge: "Príplatok",
    balance: "Zostáva doplatiť",
    invoice:
      "Príplatok je súčasťou doplatku, ktorý vám pošlem na zaplatenie zvlášť — na faktúre ho uvidíte ako samostatnú položku.",
    disagree: (email, phone) => (
      <>
        Keby ste s príplatkom nesúhlasili alebo si neboli v čomkoľvek istí, napíšte mi na {email}{" "}
        alebo zavolajte na {phone}. Rada to s vami preberiem.
      </>
    ),
    viewOrder: "Zobraziť objednávku",
  },
  pl: {
    preview: (n) =>
      `Dopłata do zamówienia indywidualnego ${n}, tak jak się umówiliśmy — na piśmie.`,
    eyebrow: "Zamówienie indywidualne",
    title: "Dopłata",
    accent: "tak jak się umówiliśmy.",
    intro: (n, title) =>
      `Potwierdzam, że do Państwa zamówienia indywidualnego${n ? ` ${n}` : ""}${title ? ` (${title})` : ""} doszła dopłata, na którą się wspólnie umówiliśmy — telefonicznie, e-mailowo lub w wiadomości. Tym e-mailem jedynie potwierdzam ją na piśmie, żeby mieli Państwo wszystko czarno na białym.`,
    order: "Zamówienie",
    product: "Wyrób",
    surcharge: "Dopłata",
    balance: "Pozostało do zapłaty",
    invoice:
      "Dopłata jest częścią pozostałej kwoty, o której zapłatę poproszę osobno — na fakturze zobaczą ją Państwo jako osobną pozycję.",
    disagree: (email, phone) => (
      <>
        Gdyby nie zgadzali się Państwo z dopłatą albo mieli jakiekolwiek wątpliwości, proszę napisać
        na {email} lub zadzwonić pod numer {phone}. Chętnie wszystko omówię.
      </>
    ),
    viewOrder: "Zobacz zamówienie",
  },
  de: {
    preview: (n) => `Aufpreis für Ihre Auftragsarbeit ${n}, wie besprochen – schriftlich.`,
    eyebrow: "Auftragsarbeit",
    title: "Aufpreis",
    accent: "wie besprochen.",
    intro: (n, title) =>
      `hiermit bestätige ich, dass zu Ihrer Auftragsarbeit${n ? ` ${n}` : ""}${title ? ` (${title})` : ""} ein Aufpreis hinzukommt, den wir miteinander vereinbart haben – telefonisch, per E-Mail oder per Nachricht. Mit dieser E-Mail bestätige ich ihn nur schriftlich, damit Sie es schwarz auf weiß haben.`,
    order: "Bestellung",
    product: "Produkt",
    surcharge: "Aufpreis",
    balance: "Noch offen",
    invoice:
      "Der Aufpreis ist Teil der Restzahlung, die ich Ihnen separat schicke – auf der Rechnung sehen Sie ihn als eigene Position.",
    disagree: (email, phone) => (
      <>
        Falls Sie mit dem Aufpreis nicht einverstanden sind oder sich bei etwas unsicher sind, schreiben
        Sie mir an {email} oder rufen Sie mich unter {phone} an. Ich bespreche es gern mit Ihnen.
      </>
    ),
    viewOrder: "Bestellung ansehen",
  },
  en: {
    preview: (n) => `The surcharge for your commission ${n}, as we agreed — in writing.`,
    eyebrow: "Commission",
    title: "The surcharge,",
    accent: "as we agreed.",
    intro: (n, title) =>
      `I'm confirming that a surcharge has been added to your commission${n ? ` ${n}` : ""}${title ? ` (${title})` : ""}, as we agreed together — by phone, by e-mail or by message. This e-mail simply confirms it in writing, so you have it in black and white.`,
    order: "Order",
    product: "Piece",
    surcharge: "Surcharge",
    balance: "Balance to pay",
    invoice:
      "The surcharge is part of the balance payment, which I'll send you separately — on the invoice you'll see it as a separate item.",
    disagree: (email, phone) => (
      <>
        If you don't agree with the surcharge or are unsure about anything, please write to me at{" "}
        {email} or call me on {phone}. I'll be happy to talk it through with you.
      </>
    ),
    viewOrder: "View order",
  },
}

/**
 * „Potvrzení příplatku" — posílá se z ručního tlačítka, až když se majitelka se
 * zákazníkem na příplatku DOMLUVÍ jinou cestou (telefon, e-mail, zpráva). Není
 * to tedy oznámení ceny z čista jasna, ale písemné potvrzení dohody: ať má
 * zákazník černé na bílém, co a za kolik přibylo, a kam se obrátit, kdyby přece
 * jen nesouhlasil. Platí se pak běžnou výzvou k doplacení, ne odtud.
 */
function SurchargeConfirmedEmailComponent({
  customerName,
  orderNumber = "",
  surchargeAmount,
  newBalance,
  reason,
  orderLink = "",
  productTitle,
}: SurchargeConfirmedEmailProps) {
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={t.preview(orderNumber)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber, productTitle ?? "")}</P>

      {reason ? <Note tone="olive">{reason}</Note> : null}

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {productTitle ? <LedgerRow label={t.product} value={productTitle} /> : null}
      {surchargeAmount ? (
        <LedgerRow label={t.surcharge} value={surchargeAmount} />
      ) : null}
      {newBalance ? (
        <LedgerRow label={t.balance} value={newBalance} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <P>{t.invoice}</P>

      <P>
        {t.disagree(
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
          <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>{CONTACT_PHONE}</a>
        )}
      </P>

      {orderLink ? (
        <ButtonRow>
          <EmailButton href={orderLink}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const SurchargeConfirmedEmail = (props: SurchargeConfirmedEmailProps) => (
  <SurchargeConfirmedEmailComponent {...props} />
)

// Mock data for preview/development (poznámka je text majitelky — jde, jak ho napíše).
const mockSurchargeConfirmed: SurchargeConfirmedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  surchargeAmount: "250 Kč",
  newBalance: "3 475 Kč",
  reason: "Telefon 5. 10. — ruční zdobení navíc",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
}

export default () => (
  <SurchargeConfirmedEmailComponent {...mockSurchargeConfirmed} />
)
