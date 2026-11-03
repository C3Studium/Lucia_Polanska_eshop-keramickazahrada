import { Section, Text } from "@react-email/components"
import {
  brand,
  ButtonRow,
  CONTACT_EMAIL,
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

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění.
 *
 * Jméno obdarovaného píše kupující, jak chce („Aničce", „Anička") — česká
 * věta „pro Aničce" s ním počítá. Slovenská a polská by potřebovaly jiný
 * pád, a ten se z cizího jména odhadnout nedá; jméno proto stojí jen
 * v řádku „Pre/Dla" pod textem, ne uvnitř věty. Němčina pád nemění.
 */
const COPY: Localized<{
  preview: (value: string, code: string) => string
  eyebrow: string
  title: string
  accent: (value: string) => string
  recipientIntro: (buyer: string | null) => string
  recipientPdf: string
  recipientPrint: string
  buyerIntro: (recipient: string | null) => string
  buyerPdf: string
  buyerNoPdf: string
  buyerPrint: string
  codeLabel: string
  forLabel: string
  valueLabel: string
  remainingLabel: string
  validLabel: string
  howTo: string
  shop: string
  downloadPdf: string
  viewPrint: string
  printCard: string
  small: (validUntil: string, contact: string) => string
  closing: string
}> = {
  cs: {
    preview: (value, code) => `Dárkový poukaz na ${value} do Keramické zahrady — kód ${code}.`,
    eyebrow: "Dárkový poukaz",
    title: "Dárkový poukaz",
    accent: (value) => `na ${value}.`,
    recipientIntro: (buyer) =>
      `${buyer ? `${buyer} vám posílá` : "dostáváte"} dárkový poukaz do mé dílny Keramická zahrada. Můžete si za něj vybrat keramiku z obchodu, nebo si u mě nechat vyrobit kousek na zakázku.`,
    recipientPdf: " Samotný poukaz najdete v příloze jako PDF — na vytištění i na ukázání v telefonu.",
    recipientPrint: " Druhá příloha je kartička k oboustrannému tisku.",
    buyerIntro: (recipient) => `děkuji, posílám dárkový poukaz${recipient ? ` pro ${recipient}` : ""}.`,
    buyerPdf: " Hotový poukaz máte v příloze jako PDF — můžete ho přeposlat, nebo vytisknout a darovat.",
    buyerNoPdf:
      " Můžete ho přeposlat, nebo vytisknout — tlačítko „Zobrazit a vytisknout“ níž otevře poukaz v podobě pro tisk.",
    buyerPrint:
      " Druhá příloha je tatáž kartička k oboustrannému tisku: vytiskněte ji oboustranně, vystřihněte podle značek a máte dárek do ruky.",
    codeLabel: "Kód poukazu",
    forLabel: "Pro",
    valueLabel: "Hodnota",
    remainingLabel: "Zbývá",
    validLabel: "Platí do",
    howTo:
      "Jak ho uplatnit: v obchodě zadejte kód v košíku nebo v pokladně do pole „Slevový kód nebo dárkový poukaz“ — částka se odečte hned. Odečítá se ze zboží, které není ve slevě; poštovné doplatíte. V dílně stačí poukaz ukázat. Platí na keramiku i na zakázky, na kurzy zatím ne. Když utratíte méně, zbytek vám na poukazu zůstane.",
    shop: "Vybrat keramiku",
    downloadPdf: "Stáhnout poukaz (PDF)",
    viewPrint: "Zobrazit a vytisknout",
    printCard: "Kartička k tisku (PDF)",
    small: (validUntil, contact) =>
      `Poukaz nejde vyměnit za peníze a po ${validUntil} ho už uplatnit nepůjde. Kdybyste si nebyli jistí zůstatkem nebo čímkoli jiným, napište mi na ${contact} — odpovídám sama.`,
    closing: "Ať vám udělá radost,",
  },
  sk: {
    preview: (value, code) => `Darčekový poukaz na ${value} do Keramickej záhrady — kód ${code}.`,
    eyebrow: "Darčekový poukaz",
    title: "Darčekový poukaz",
    accent: (value) => `na ${value}.`,
    recipientIntro: (buyer) =>
      `${buyer ? `${buyer} vám posiela` : "dostávate"} darčekový poukaz do mojej dielne Keramická zahrada. Môžete si zaň vybrať keramiku z obchodu alebo si u mňa nechať vyrobiť kúsok na zákazku.`,
    recipientPdf: " Samotný poukaz nájdete v prílohe ako PDF — na vytlačenie aj na ukázanie v telefóne.",
    recipientPrint: " Druhá príloha je kartička na obojstrannú tlač.",
    buyerIntro: () => "ďakujem, posielam darčekový poukaz, ktorý ste kúpili.",
    buyerPdf: " Hotový poukaz máte v prílohe ako PDF — môžete ho preposlať alebo vytlačiť a darovať.",
    buyerNoPdf:
      " Môžete ho preposlať alebo vytlačiť — tlačidlo „Zobraziť a vytlačiť“ nižšie otvorí poukaz v podobe na tlač.",
    buyerPrint:
      " Druhá príloha je tá istá kartička na obojstrannú tlač: vytlačte ju obojstranne, vystrihnite podľa značiek a darček máte v ruke.",
    codeLabel: "Kód poukazu",
    forLabel: "Pre",
    valueLabel: "Hodnota",
    remainingLabel: "Zostáva",
    validLabel: "Platí do",
    howTo:
      "Ako ho uplatniť: v obchode zadajte kód v košíku alebo v pokladni do poľa na zľavový kód alebo darčekový poukaz — suma sa odpočíta hneď. Odpočítava sa z tovaru, ktorý nie je v zľave; poštovné doplatíte. V dielni stačí poukaz ukázať. Platí na keramiku aj na zákazky, na kurzy zatiaľ nie. Keď minete menej, zvyšok vám na poukaze zostane.",
    shop: "Vybrať keramiku",
    downloadPdf: "Stiahnuť poukaz (PDF)",
    viewPrint: "Zobraziť a vytlačiť",
    printCard: "Kartička na tlač (PDF)",
    small: (validUntil, contact) =>
      `Poukaz nie je možné vymeniť za peniaze a po ${validUntil} ho už nebude možné uplatniť. Keby ste si neboli istí zostatkom alebo čímkoľvek iným, napíšte mi na ${contact} — odpovedám sama.`,
    closing: "Nech vám urobí radosť,",
  },
  pl: {
    preview: (value, code) => `Bon podarunkowy na ${value} do Keramickiej Zahrady — kod ${code}.`,
    eyebrow: "Bon podarunkowy",
    title: "Bon podarunkowy",
    accent: (value) => `na ${value}.`,
    recipientIntro: (buyer) =>
      `${buyer ? `${buyer} przesyła Państwu` : "Otrzymują Państwo"} bon podarunkowy do mojej pracowni Keramická zahrada. Można za niego wybrać ceramikę ze sklepu albo zlecić mi wykonanie czegoś na zamówienie.`,
    recipientPdf: " Sam bon znajdą Państwo w załączniku jako PDF — do wydrukowania albo do pokazania w telefonie.",
    recipientPrint: " Drugi załącznik to karta do druku dwustronnego.",
    buyerIntro: () => "Dziękuję, przesyłam zakupiony bon podarunkowy.",
    buyerPdf: " Gotowy bon jest w załączniku jako PDF — można go przesłać dalej albo wydrukować i podarować.",
    buyerNoPdf:
      " Można go przesłać dalej albo wydrukować — przycisk „Pokaż i wydrukuj” poniżej otworzy bon w wersji do druku.",
    buyerPrint:
      " Drugi załącznik to ta sama karta do druku dwustronnego: wystarczy wydrukować ją dwustronnie, wyciąć wzdłuż znaczników i prezent gotowy.",
    codeLabel: "Kod bonu",
    forLabel: "Dla",
    valueLabel: "Wartość",
    remainingLabel: "Pozostało",
    validLabel: "Ważny do",
    howTo:
      "Jak go wykorzystać: w sklepie należy wpisać kod w koszyku lub przy kasie w polu na kod rabatowy lub bon podarunkowy — kwota zostanie od razu odjęta. Odejmuje się ją od towarów, które nie są przecenione; koszt wysyłki trzeba dopłacić. W pracowni wystarczy pokazać bon. Bon obejmuje ceramikę i zamówienia indywidualne, na razie nie warsztaty. Jeśli wydadzą Państwo mniej, reszta zostaje na bonie.",
    shop: "Wybierz ceramikę",
    downloadPdf: "Pobierz bon (PDF)",
    viewPrint: "Pokaż i wydrukuj",
    printCard: "Karta do druku (PDF)",
    small: (validUntil, contact) =>
      `Bonu nie można wymienić na gotówkę, a po ${validUntil} nie będzie już można go wykorzystać. W razie wątpliwości co do salda lub czegokolwiek innego proszę napisać na ${contact} — odpowiadam osobiście.`,
    closing: "Niech sprawi radość!",
  },
  de: {
    preview: (value, code) => `Geschenkgutschein über ${value} für die Keramická zahrada – Code ${code}.`,
    eyebrow: "Geschenkgutschein",
    title: "Geschenkgutschein",
    accent: (value) => `über ${value}.`,
    recipientIntro: (buyer) =>
      `${buyer ? `${buyer} schenkt Ihnen` : "Sie erhalten"} einen Geschenkgutschein für meine Werkstatt Keramická zahrada. Sie können damit Keramik aus dem Shop auswählen oder sich bei mir ein Stück auf Bestellung anfertigen lassen.`,
    recipientPdf: " Den Gutschein selbst finden Sie im Anhang als PDF – zum Ausdrucken oder zum Vorzeigen auf dem Handy.",
    recipientPrint: " Der zweite Anhang ist eine Karte für den beidseitigen Druck.",
    buyerIntro: (recipient) =>
      `vielen Dank, hier ist Ihr Geschenkgutschein${recipient ? ` für ${recipient}` : ""}.`,
    buyerPdf: " Den fertigen Gutschein finden Sie im Anhang als PDF – Sie können ihn weiterleiten oder ausdrucken und verschenken.",
    buyerNoPdf:
      " Sie können ihn weiterleiten oder ausdrucken – die Schaltfläche „Ansehen und drucken“ unten öffnet den Gutschein in der Druckansicht.",
    buyerPrint:
      " Der zweite Anhang ist dieselbe Karte für den beidseitigen Druck: beidseitig ausdrucken, an den Markierungen ausschneiden – und schon haben Sie ein Geschenk in der Hand.",
    codeLabel: "Gutscheincode",
    forLabel: "Für",
    valueLabel: "Wert",
    remainingLabel: "Restguthaben",
    validLabel: "Gültig bis",
    howTo:
      "So lösen Sie ihn ein: Geben Sie den Code im Shop im Warenkorb oder an der Kasse in das Feld für Rabattcode oder Geschenkgutschein ein – der Betrag wird sofort abgezogen. Er wird auf Ware angerechnet, die nicht reduziert ist; die Versandkosten zahlen Sie dazu. In der Werkstatt genügt es, den Gutschein vorzuzeigen. Er gilt für Keramik und Auftragsarbeiten, für Kurse vorerst nicht. Geben Sie weniger aus, bleibt der Rest auf dem Gutschein.",
    shop: "Keramik auswählen",
    downloadPdf: "Gutschein herunterladen (PDF)",
    viewPrint: "Ansehen und drucken",
    printCard: "Karte zum Ausdrucken (PDF)",
    small: (validUntil, contact) =>
      `Der Gutschein kann nicht in Geld umgetauscht werden und ist nach dem ${validUntil} nicht mehr einlösbar. Wenn Sie beim Restguthaben oder bei etwas anderem unsicher sind, schreiben Sie mir an ${contact} – ich antworte selbst.`,
    closing: "Viel Freude damit!",
  },
  en: {
    preview: (value, code) => `A ${value} gift voucher for Keramická zahrada — code ${code}.`,
    eyebrow: "Gift voucher",
    title: "Gift voucher",
    accent: (value) => `worth ${value}.`,
    recipientIntro: (buyer) =>
      `${buyer ? `${buyer} is sending you` : "You have received"} a gift voucher for my studio, Keramická zahrada. You can spend it on ceramics from the shop, or have me make a commissioned piece just for you.`,
    recipientPdf: " The voucher itself is attached as a PDF — print it out or simply show it on your phone.",
    recipientPrint: " The second attachment is a card for double-sided printing.",
    buyerIntro: (recipient) => `Thank you — here is your gift voucher${recipient ? ` for ${recipient}` : ""}.`,
    buyerPdf: " The finished voucher is attached as a PDF — you can forward it, or print it out and give it as a gift.",
    buyerNoPdf:
      " You can forward it or print it out — the “View and print” button below opens the voucher ready for printing.",
    buyerPrint:
      " The second attachment is the same card for double-sided printing: print it on both sides, cut along the marks, and you have a gift ready to hand over.",
    codeLabel: "Voucher code",
    forLabel: "For",
    valueLabel: "Value",
    remainingLabel: "Remaining",
    validLabel: "Valid until",
    howTo:
      "How to redeem it: in the shop, enter the code in your basket or at checkout in the “Discount code or gift voucher” field — the amount is deducted straight away. It applies to items that aren't already discounted; postage is paid separately. At the studio, just show the voucher. It can be used for ceramics and commissions, but not for workshops for now. If you spend less than its value, the rest stays on the voucher.",
    shop: "Browse ceramics",
    downloadPdf: "Download voucher (PDF)",
    viewPrint: "View and print",
    printCard: "Printable card (PDF)",
    small: (validUntil, contact) =>
      `The voucher can't be exchanged for cash and can no longer be redeemed after ${validUntil}. If you're unsure about the balance or anything else, write to me at ${contact} — I answer every message myself.`,
    closing: "I hope it brings you joy,",
  },
}

/**
 * Elektronický dárkový poukaz (stránka Poukazy, `lib/gift-voucher-emails.ts`).
 *
 * Jde obdarovanému (`toRecipient`), nebo kupujícímu, když e-mail
 * obdarovaného chybí — text se podle toho mění („dostáváte poukaz“ /
 * „posílám poukaz, který jste koupili“). Kód je v e-mailu celý: e-mail
 * odchází až po zaplacení.
 */
export interface GiftVoucherEmailProps {
  code?: string
  value?: string
  balance?: string
  partlyUsed?: boolean
  validUntil?: string
  recipientName?: string | null
  buyerName?: string | null
  dedication?: string | null
  toRecipient?: boolean
  voucherUrl?: string
  /** Vystavené PDF poukazu (příloha téhož e-mailu), nebo null. */
  pdfUrl?: string | null
  /** Druhá příloha: dvě stránky A4 k oboustrannému tisku kartičky. */
  printPdfUrl?: string | null
}

function GiftVoucherEmailComponent({
  code = "",
  value = "",
  balance = "",
  partlyUsed = false,
  validUntil = "",
  recipientName = null,
  buyerName = null,
  dedication = null,
  toRecipient = true,
  voucherUrl = "",
  pdfUrl = null,
  printPdfUrl = null,
}: GiftVoucherEmailProps) {
  const t = useCopy(COPY)
  const shopUrl = storeLink()
  return (
    <EmailLayout preview={t.preview(value, code)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent(value)}>{t.title}</EmailH1>

      {toRecipient ? (
        <>
          <Greeting name={null} />
          <P>
            {t.recipientIntro(buyerName)}
            {pdfUrl ? t.recipientPdf : ""}
            {printPdfUrl ? t.recipientPrint : ""}
          </P>
        </>
      ) : (
        <>
          <Greeting name={buyerName} />
          <P>
            {t.buyerIntro(recipientName)}
            {pdfUrl ? t.buyerPdf : t.buyerNoPdf}
            {printPdfUrl ? t.buyerPrint : ""}
          </P>
        </>
      )}

      {dedication ? (
        <Text
          style={{
            fontFamily: brand.serif,
            fontStyle: "italic",
            fontSize: "18px",
            lineHeight: "27px",
            color: brand.ink,
            margin: "8px 0 22px",
          }}
        >
          „{dedication}“
        </Text>
      ) : null}

      <Section
        style={{
          border: `1px solid ${brand.line}`,
          borderRadius: "14px",
          padding: "20px 22px",
          margin: "0 0 22px",
          textAlign: "center",
        }}
      >
        <Eyebrow style={{ margin: "0 0 8px" }}>{t.codeLabel}</Eyebrow>
        <Text
          style={{
            fontFamily: brand.serif,
            fontSize: "30px",
            lineHeight: "36px",
            letterSpacing: "3px",
            color: brand.ink,
            margin: 0,
          }}
        >
          {code}
        </Text>
      </Section>

      {recipientName ? <LedgerRow label={t.forLabel} value={recipientName} /> : null}
      <LedgerRow label={t.valueLabel} value={value} strong />
      {partlyUsed ? <LedgerRow label={t.remainingLabel} value={balance} tone="olive" /> : null}
      <LedgerRow label={t.validLabel} value={validUntil} />
      <LedgerEnd />

      <Note>{t.howTo}</Note>

      <ButtonRow>
        {shopUrl ? <EmailButton href={shopUrl}>{t.shop}</EmailButton> : null}
        {pdfUrl ? (
          <EmailButton href={pdfUrl} variant="ghost">
            {t.downloadPdf}
          </EmailButton>
        ) : voucherUrl ? (
          <EmailButton href={voucherUrl} variant="ghost">
            {t.viewPrint}
          </EmailButton>
        ) : null}
        {printPdfUrl ? (
          <>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={printPdfUrl} variant="ghost">
              {t.printCard}
            </EmailButton>
          </>
        ) : null}
      </ButtonRow>

      <P small>{t.small(validUntil, CONTACT_EMAIL)}</P>
      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const GiftVoucherEmail = (props: GiftVoucherEmailProps) => <GiftVoucherEmailComponent {...props} />

/* Náhled — dřív byly tyhle hodnoty výchozí hodnoty props, takže e-mail, kterému
   odesílatel pole vynechal, by nesl vymyšlený kód a věnování. */
const mockGiftVoucher: GiftVoucherEmailProps = {
  code: "7HQ4 M2XP",
  value: "1 000 Kč",
  balance: "1 000 Kč",
  partlyUsed: false,
  validUntil: "24. 10. 2027",
  recipientName: "Aničce",
  buyerName: "Babička Jana",
  dedication: "K narozeninám — ať ti kvete celý rok.",
  toRecipient: true,
  voucherUrl: "https://keramickazahrada.cz/cz/poukaz/gv_123?token=abc",
  pdfUrl: "https://img.matejforejt.com/gift-vouchers/gv_123/poukaz-1a2b3c4d.pdf",
  printPdfUrl: "https://img.matejforejt.com/gift-vouchers/gv_123/poukaz-k-tisku-5e6f7a8b.pdf",
}

export default () => <GiftVoucherEmailComponent {...mockGiftVoucher} />
