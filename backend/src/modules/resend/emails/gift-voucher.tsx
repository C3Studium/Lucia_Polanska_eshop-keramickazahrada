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
  code = "7HQ4 M2XP",
  value = "1 000 Kč",
  balance = "1 000 Kč",
  partlyUsed = false,
  validUntil = "24. 10. 2027",
  recipientName = "Aničce",
  buyerName = "Babička Jana",
  dedication = "K narozeninám, ať ti na zahradě kvete i v zimě.",
  toRecipient = true,
  voucherUrl = "https://keramickazahrada.cz/cz/poukaz/gv_123?token=abc",
  pdfUrl = "https://img.matejforejt.com/gift-vouchers/gv_123/poukaz-1a2b3c4d.pdf",
  printPdfUrl = "https://img.matejforejt.com/gift-vouchers/gv_123/poukaz-k-tisku-5e6f7a8b.pdf",
}: GiftVoucherEmailProps) {
  const shopUrl = storeLink()
  return (
    <EmailLayout preview={`Dárkový poukaz na ${value} do Keramické zahrady — kód ${code}.`}>
      <Eyebrow>Dárkový poukaz</Eyebrow>
      <EmailH1 accent={`na ${value}.`}>Dárkový poukaz</EmailH1>

      {toRecipient ? (
        <>
          <Greeting name={null} />
          <P>
            {buyerName ? `${buyerName} vám posílá` : "dostáváte"} dárkový poukaz do mé dílny
            Keramická zahrada. Můžete si za něj vybrat keramiku z obchodu, nebo si u mě nechat
            vyrobit kousek na zakázku.
            {pdfUrl ? " Samotný poukaz najdete v příloze jako PDF — na vytištění i na ukázání v telefonu." : ""}
            {printPdfUrl ? " Druhá příloha je kartička k oboustrannému tisku." : ""}
          </P>
        </>
      ) : (
        <>
          <Greeting name={buyerName} />
          <P>
            děkuji, posílám dárkový poukaz{recipientName ? ` pro ${recipientName}` : ""}.
            {pdfUrl
              ? " Hotový poukaz máte v příloze jako PDF — můžete ho přeposlat, nebo vytisknout a darovat."
              : " Můžete ho přeposlat, nebo vytisknout — tlačítko „Zobrazit a vytisknout“ níž otevře poukaz v podobě pro tisk."}
            {printPdfUrl
              ? " Druhá příloha je tatáž kartička k oboustrannému tisku: vytiskněte ji oboustranně, vystřihněte podle značek a máte dárek do ruky."
              : ""}
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
        <Eyebrow style={{ margin: "0 0 8px" }}>Kód poukazu</Eyebrow>
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

      {recipientName ? <LedgerRow label="Pro" value={recipientName} /> : null}
      <LedgerRow label="Hodnota" value={value} strong />
      {partlyUsed ? <LedgerRow label="Zbývá" value={balance} tone="olive" /> : null}
      <LedgerRow label="Platí do" value={validUntil} />
      <LedgerEnd />

      <Note>
        Jak ho uplatnit: v obchodě zadejte kód v košíku nebo v pokladně do pole „Slevový kód
        nebo dárkový poukaz“ — částka se odečte hned. Odečítá se ze zboží, které není ve slevě;
        poštovné doplatíte. V dílně stačí poukaz ukázat. Platí na keramiku i na zakázky, na
        kurzy zatím ne. Když utratíte méně, zbytek vám na poukazu zůstane.
      </Note>

      <ButtonRow>
        {shopUrl ? <EmailButton href={shopUrl}>Vybrat keramiku</EmailButton> : null}
        {pdfUrl ? (
          <EmailButton href={pdfUrl} variant="ghost">
            Stáhnout poukaz (PDF)
          </EmailButton>
        ) : voucherUrl ? (
          <EmailButton href={voucherUrl} variant="ghost">
            Zobrazit a vytisknout
          </EmailButton>
        ) : null}
        {printPdfUrl ? (
          <>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={printPdfUrl} variant="ghost">
              Kartička k tisku (PDF)
            </EmailButton>
          </>
        ) : null}
      </ButtonRow>

      <P small>
        Poukaz nejde vyměnit za peníze a po {validUntil} ho už uplatnit nepůjde. Kdybyste si
        nebyli jistí zůstatkem nebo čímkoli jiným, napište mi na {CONTACT_EMAIL} — odpovídám
        sama.
      </P>
      <Signature closing="Ať vám udělá radost," />
    </EmailLayout>
  )
}

export const GiftVoucherEmail = (props: GiftVoucherEmailProps) => <GiftVoucherEmailComponent {...props} />

export default () => <GiftVoucherEmailComponent />
