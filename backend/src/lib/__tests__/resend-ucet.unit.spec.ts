import { posudUcetResend, PRODUKCNI_DOMENY_RESEND } from "../resend-ucet"

/*
 * Hlídka „E-maily jdou přes produkční účet Resend" (22. 11. 2026).
 *
 * 21. 11. obchod do 16:36 posílal přes TESTOVACÍ účet Resend (klíč v Railway
 * se změnil až s novým nasazením) a v 16:36–16:44 přes produkční účet, kde
 * doména ještě nebyla ověřená (403). Ani jedno nebylo nikde vidět.
 */

const PROD_ID = PRODUKCNI_DOMENY_RESEND["keramickazahrada.cz"]
const TEST_ID = "02892a18-846f-44f2-8cd5-75a4dabd0ba0" // keramickazahrada.cz v testovacím účtu

const domena = (over: Record<string, unknown> = {}) => ({
  id: PROD_ID,
  name: "keramickazahrada.cz",
  status: "verified",
  ...over,
})

describe("účet Resend za klíčem", () => {
  it("produkční účet s ověřenou doménou odesílatele = v pořádku", () => {
    const n = posudUcetResend({ from: "Keramická zahrada <info@keramickazahrada.cz>", domeny: [domena()] })
    expect(n.stav).toBe("ok")
  })

  it("testovací účet (stejná doména, jiné id) = chyba, i když je doména ověřená", () => {
    const n = posudUcetResend({ from: "info@keramickazahrada.cz", domeny: [domena({ id: TEST_ID })] })
    expect(n.stav).toBe("chyba")
    expect(n.zprava).toMatch(/jiný účet|testovací/i)
  })

  it("doména v účtu není ověřená (21. 11. 16:37) = chyba", () => {
    const n = posudUcetResend({ from: "info@keramickazahrada.cz", domeny: [domena({ status: "pending" })] })
    expect(n.stav).toBe("chyba")
    expect(n.zprava).toMatch(/ověřen/)
  })

  it("doména odesílatele v účtu vůbec není = chyba", () => {
    const n = posudUcetResend({ from: "info@keramickazahrada.cz", domeny: [domena({ name: "admin.keramickazahrada.cz", id: "x" })] })
    expect(n.stav).toBe("chyba")
  })

  it("odesílatel z domény, pro kterou id neznáme = jen ověření domény", () => {
    const n = posudUcetResend({ from: "noreply@jina-domena.cz", domeny: [domena({ name: "jina-domena.cz", id: "y" })] })
    expect(n.stav).toBe("ok")
  })

  it("výjimka z prostředí přepíše výchozí id (další přechod účtu)", () => {
    const n = posudUcetResend({
      from: "info@keramickazahrada.cz",
      domeny: [domena({ id: TEST_ID })],
      ocekavaneId: TEST_ID,
    })
    expect(n.stav).toBe("ok")
  })

  it("bez odesílatele = nenastaveno", () => {
    expect(posudUcetResend({ from: "", domeny: [] }).stav).toBe("nenastaveno")
  })
})
