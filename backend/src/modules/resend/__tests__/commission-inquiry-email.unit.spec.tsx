import { renderToStaticMarkup } from "react-dom/server"
import { CommissionInquiryReceivedEmail } from "../emails/commission-inquiry-received"

/**
 * „Poptávku jsme přijali" — potvrzení poptávky zakázky (stránka Výroba).
 * Musí shrnout, co zákazník poslal, říct, co bude dál (nabídka → potvrzení
 * nebo záloha = smlouva → výroba), poučit o § 1837 písm. d) OZ a zapsat verzi
 * OP s časem souhlasu.
 */
describe("e-mail commission-inquiry-received", () => {
  const text = (html: string) =>
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, " ")

  it("shrnutí, další kroky, poučení a souhlas s verzí OP", () => {
    const html = renderToStaticMarkup(
      <CommissionInquiryReceivedEmail
        customerName="Jana Nováková"
        description={"Domovní číslo 229.\nK terakotové střeše."}
        dimensions="30 × 20 cm"
        motif="229"
        deadline="do Vánoc"
        phone="+420 603 123 456"
        photoCount={3}
        termsVersion="2026-10-15"
        termsVersionLabel="15. 10. 2026"
        consentedAtLabel="14. 10. 2026 15:32"
        termsUrl="https://keramickazahrada.cz/cz/smluvni-podminky#vyroba-na-zakazku"
        privacyUrl="https://keramickazahrada.cz/cz/ochrana-osobnich-udaju"
      />
    )
    const out = text(html)

    expect(out).toContain("Děkuji za")
    expect(out).toContain("poptávku.")
    expect(out).toContain("Dobrý den, Jana Nováková,")
    expect(out).toContain("Domovní číslo 229.")
    expect(out).toContain("K terakotové střeše.")
    expect(out).toContain("30 × 20 cm")
    expect(out).toContain("do Vánoc")
    expect(out).toContain("3 fotky")
    expect(out).toContain("+420 603 123 456")

    expect(out).toContain("cenou, dodací lhůtou a výší zálohy")
    expect(out).toContain("Smlouva vzniká, až nabídku potvrdíte nebo zaplatíte zálohu")
    expect(out).toContain("§ 1837 písm. d)")
    expect(out).toContain("obchodními podmínkami ve znění účinném od 15. 10. 2026")
    expect(out).toContain("(14. 10. 2026 15:32)")
    expect(out).toContain("zásady ochrany osobních údajů")

    expect(html).toContain('href="https://keramickazahrada.cz/cz/smluvni-podminky#vyroba-na-zakazku"')
    expect(html).toContain('href="https://keramickazahrada.cz/cz/ochrana-osobnich-udaju"')
  })

  it("bez volitelných polí, bez fotek a bez známé verze OP nic nevynechá ani nerozbije", () => {
    const out = text(
      renderToStaticMarkup(<CommissionInquiryReceivedEmail description="Reliéf" />)
    )
    expect(out).toContain("Dobrý den,")
    expect(out).toContain("Reliéf")
    expect(out).not.toContain("Rozměry")
    expect(out).not.toContain("Fotografie místa")
    expect(out).not.toContain("undefined")
    expect(out).not.toContain("null")
    expect(out).toContain("souhlas s obchodními podmínkami.")
    expect(out).toContain("§ 1837 písm. d)")
  })
})
