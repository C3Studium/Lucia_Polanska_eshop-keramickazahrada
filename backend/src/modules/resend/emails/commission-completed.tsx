import { Img, Section } from "@react-email/components"
import {
  brand,
  ButtonRow,
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
import { storeLink } from "../../../lib/storefront-url"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

interface CommissionCompletedEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Plně zaplaceno? Pak se chystá k odeslání; jinak zbývá doplatit. */
  fullyPaid?: boolean;
  /** Kolik ještě zbývá doplatit (naformátované) — jen když fullyPaid=false. */
  balanceDue?: string | null;
  /** Nejnovější sdílená fotka hotového kousku, když ji ateliér přidal. */
  makingPhotoUrl?: string | null;
  /** Název položky zakázky — u objednávky s víc zakázkami říká, který kus je hotový. */
  productTitle?: string | null;
}

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (orderNumber: string, fullyPaid: boolean) => string
  eyebrow: string
  title: string
  accent: string
  intro: (orderNumber: string, productTitle: string) => string
  photoAlt: string
  paidNote: string
  paidNext: string
  balanceDue: string
  balanceNext: string
  viewOrder: string
  questions: string
  closing: string
}> = {
  cs: {
    preview: (n, paid) =>
      `Zakázka ${n} je hotová${paid ? " — chystám ji k odeslání." : " — zbývá doplatek."}`,
    eyebrow: "Zakázka",
    title: "Zakázka",
    accent: "je hotová.",
    intro: (n, title) =>
      `mám radost — vaše zakázka${n ? ` ${n}` : ""}${title ? ` (${title})` : ""} je hotová. Vznikala u mě v dílně kousek po kousku a teď je na světě.`,
    photoAlt: "Hotový kousek",
    paidNote: "Je zaplacená celá — chystám ji k odeslání.",
    paidNext: "Teď ji pečlivě zabalím a předám dopravci. Jakmile vyrazí na cestu, napíšu vám.",
    balanceDue: "Zbývá doplatit",
    balanceNext:
      "Zbývá doplatit zbytek ceny — výzvu k platbě s odkazem vám pošlu zvlášť. Jakmile doplatek dorazí, kousek zabalím a předám dopravci.",
    viewOrder: "Zobrazit objednávku",
    questions:
      "Kdybyste chtěli cokoli domluvit jinak, napište mi na info@keramickazahrada.cz — odpovídám sama.",
    closing: "Mějte se krásně,",
  },
  sk: {
    preview: (n, paid) =>
      `Zákazka ${n} je hotová${paid ? " — chystám ju na odoslanie." : " — zostáva doplatok."}`,
    eyebrow: "Zákazka",
    title: "Zákazka",
    accent: "je hotová.",
    intro: (n, title) =>
      `mám radosť — vaša zákazka${n ? ` ${n}` : ""}${title ? ` (${title})` : ""} je hotová. Vznikala u mňa v dielni kúsok po kúsku a teraz je na svete.`,
    photoAlt: "Hotový kúsok",
    paidNote: "Je zaplatená celá — chystám ju na odoslanie.",
    paidNext: "Teraz ju starostlivo zabalím a odovzdám prepravcovi. Hneď ako vyrazí na cestu, napíšem vám.",
    balanceDue: "Zostáva doplatiť",
    balanceNext:
      "Zostáva doplatiť zvyšok ceny — výzvu na platbu s odkazom vám pošlem zvlášť. Hneď ako doplatok dorazí, kúsok zabalím a odovzdám prepravcovi.",
    viewOrder: "Zobraziť objednávku",
    questions:
      "Keby ste sa chceli na čomkoľvek dohodnúť inak, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
    closing: "Majte sa krásne,",
  },
  pl: {
    preview: (n, paid) =>
      `Zamówienie indywidualne ${n} jest gotowe${paid ? " — przygotowuję je do wysyłki." : " — pozostała dopłata."}`,
    eyebrow: "Zamówienie indywidualne",
    title: "Wyrób na zamówienie",
    accent: "jest gotowy.",
    intro: (n, title) =>
      `Mam wielką radość — Państwa zamówienie indywidualne${n ? ` ${n}` : ""}${title ? ` (${title})` : ""} jest gotowe. Powstawało w mojej pracowni krok po kroku i teraz jest już na świecie.`,
    photoAlt: "Gotowy wyrób",
    paidNote: "Całość jest zapłacona — przygotowuję wysyłkę.",
    paidNext:
      "Teraz starannie je zapakuję i przekażę przewoźnikowi. Gdy tylko wyruszy w drogę, napiszę do Państwa.",
    balanceDue: "Pozostało do zapłaty",
    balanceNext:
      "Pozostaje do zapłaty reszta ceny — prośbę o płatność z linkiem wyślę osobno. Gdy tylko dopłata dotrze, zapakuję wyrób i przekażę go przewoźnikowi.",
    viewOrder: "Zobacz zamówienie",
    questions:
      "Jeśli chcieliby Państwo cokolwiek ustalić inaczej, proszę napisać na info@keramickazahrada.cz — odpowiadam osobiście.",
    closing: "Serdecznie pozdrawiam",
  },
  de: {
    preview: (n, paid) =>
      `Ihre Auftragsarbeit ${n} ist fertig${paid ? " – ich bereite den Versand vor." : " – es fehlt noch die Restzahlung."}`,
    eyebrow: "Auftragsarbeit",
    title: "Ihre Auftragsarbeit",
    accent: "ist fertig.",
    intro: (n, title) =>
      `ich freue mich sehr – Ihre Auftragsarbeit${n ? ` ${n}` : ""}${title ? ` (${title})` : ""} ist fertig. Sie ist in meiner Werkstatt Schritt für Schritt entstanden und jetzt ist sie da.`,
    photoAlt: "Das fertige Stück",
    paidNote: "Sie ist vollständig bezahlt – ich bereite den Versand vor.",
    paidNext:
      "Jetzt verpacke ich sie sorgfältig und übergebe sie dem Versanddienst. Sobald sie unterwegs ist, schreibe ich Ihnen.",
    balanceDue: "Noch offen",
    balanceNext:
      "Offen ist noch der Restbetrag – die Zahlungsaufforderung mit Link schicke ich Ihnen separat. Sobald die Restzahlung eingegangen ist, verpacke ich das Stück und übergebe es dem Versanddienst.",
    viewOrder: "Bestellung ansehen",
    questions:
      "Wenn Sie etwas anders vereinbaren möchten, schreiben Sie mir an info@keramickazahrada.cz – ich antworte persönlich.",
    closing: "Alles Gute und herzliche Grüße",
  },
  en: {
    preview: (n, paid) =>
      `Your commission ${n} is finished${paid ? " — I'm getting it ready to send." : " — only the balance payment remains."}`,
    eyebrow: "Commission",
    title: "Your commission",
    accent: "is finished.",
    intro: (n, title) =>
      `I'm so pleased — your commission${n ? ` ${n}` : ""}${title ? ` (${title})` : ""} is finished. It took shape in my studio bit by bit, and now it's ready.`,
    photoAlt: "The finished piece",
    paidNote: "It is fully paid — I'm getting it ready to send.",
    paidNext:
      "Now I'll pack it carefully and hand it over to the carrier. As soon as it's on its way, I'll let you know.",
    balanceDue: "Balance to pay",
    balanceNext:
      "The rest of the price is still to be paid — I'll send you a separate payment request with a link. As soon as the balance payment arrives, I'll pack your piece and hand it over to the carrier.",
    viewOrder: "View order",
    questions:
      "If you'd like to arrange anything differently, just write to me at info@keramickazahrada.cz — I answer every e-mail myself.",
    closing: "All the best,",
  },
}

/**
 * „Vaše zakázka je hotová" — posílá se při dokončení výroby
 * (`made-to-order.production-completed`). Dva případy:
 *  - plně zaplaceno → zakázka se chystá k odeslání;
 *  - zbývá doplatit → zakázka je hotová a brzy přijde výzva k doplacení
 *    (samotný platební odkaz nese ruční výzva k doplatku, ne tento e-mail).
 */
function CommissionCompletedEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  fullyPaid = true,
  balanceDue,
  makingPhotoUrl,
  productTitle,
}: CommissionCompletedEmailProps) {
  const t = useCopy(COPY)
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout preview={t.preview(orderNumber, fullyPaid)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber, productTitle ?? "")}</P>

      {makingPhotoUrl ? (
        <Section style={{ margin: "20px 0 0" }}>
          <Img
            src={makingPhotoUrl}
            alt={t.photoAlt}
            width="100%"
            style={{
              maxWidth: "420px",
              borderRadius: "12px",
              objectFit: "cover",
              backgroundColor: brand.stone,
            }}
          />
        </Section>
      ) : null}

      {fullyPaid ? (
        <>
          <Note tone="olive">{t.paidNote}</Note>
          <P style={{ margin: "20px 0 0" }}>{t.paidNext}</P>
        </>
      ) : (
        <>
          {balanceDue ? (
            <>
              <LedgerRow label={t.balanceDue} value={balanceDue} strong tone="olive" />
              <LedgerEnd />
            </>
          ) : null}
          <P>{t.balanceNext}</P>
        </>
      )}

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>{t.questions}</P>

      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const CommissionCompletedEmail = (
  props: CommissionCompletedEmailProps
) => <CommissionCompletedEmailComponent {...props} />

// Mock data for preview/development
const mockCommissionCompleted: CommissionCompletedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#0026",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  fullyPaid: false,
  balanceDue: "2 795 Kč",
  makingPhotoUrl:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
}

export default () => (
  <CommissionCompletedEmailComponent {...mockCommissionCompleted} />
)
