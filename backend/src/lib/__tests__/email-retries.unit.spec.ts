/**
 * „Nezdařené (193)" nesmí počítat e-maily, které mezitím v pořádku odešly.
 *
 * Vzniklo z reálné stížnosti: potvrzení objednávky selhalo, tlačítko „Poslat
 * znovu" ho odeslalo, Resend potvrdil doručení — a v administraci pořád svítilo
 * červené „Nepodařilo se".
 */
import { jeVyresena, vyreseneKoreny } from "../email-retries"

describe("vyřešená nezdařená odeslání", () => {
  it("nezdařený e-mail bez opakování zůstává nezdařený", () => {
    const koreny = vyreseneKoreny([])
    expect(jeVyresena({ id: "noti_A" }, koreny)).toBe(false)
  })

  it("úspěšné opakování vyřeší svůj původní řádek", () => {
    const koreny = vyreseneKoreny([
      { id: "noti_B", original_notification_id: "noti_A" },
    ])
    expect(jeVyresena({ id: "noti_A" }, koreny)).toBe(true)
  })

  it("vyřeší i sourozence, kterým se to taky nepovedlo", () => {
    // A selhalo, r2 (B) selhalo, r3 (C) prošlo. Oba pokusy ukazují na kořen A.
    const koreny = vyreseneKoreny([
      { id: "noti_C", original_notification_id: "noti_A" },
    ])
    expect(jeVyresena({ id: "noti_A" }, koreny)).toBe(true)
    expect(jeVyresena({ id: "noti_B", original_notification_id: "noti_A" }, koreny)).toBe(true)
  })

  it("cizí řetězec se tím nevyřeší", () => {
    const koreny = vyreseneKoreny([
      { id: "noti_B", original_notification_id: "noti_A" },
    ])
    expect(jeVyresena({ id: "noti_X" }, koreny)).toBe(false)
    expect(jeVyresena({ id: "noti_Y", original_notification_id: "noti_X" }, koreny)).toBe(false)
  })

  it("e-mail, který prošel napoprvé, nikoho neřeší kromě sebe", () => {
    const koreny = vyreseneKoreny([{ id: "noti_S", original_notification_id: null }])
    expect(jeVyresena({ id: "noti_S" }, koreny)).toBe(true)
    expect(jeVyresena({ id: "noti_A" }, koreny)).toBe(false)
  })
})
