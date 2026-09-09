/**
 * Rozpoznávání chyb u nočních upomínek na opuštěný košík.
 *
 * Proč zrovna tohle: Resend pouští 10 požadavků za sekundu a notifikační modul
 * Medusy posílá celé pole jedním `promiseAll` bez škrcení. Dávka 100 košíků
 * tedy znamenala 100 souběžných požadavků — naměřeno na produkčním klíči:
 * projde 10, zbylých 90 se vrátí s HTTP 429. V produkční databázi z toho bylo
 * 191 nezdařených upomínek a nula košíků s příznakem `abandoned_notification`,
 * protože krok padal a razítkovací krok za ním se nespustil.
 *
 * Klíčové rozhodnutí kroku je právě tohle: která chyba se má zítra zkusit
 * znovu a která znamená, že se ten košík už upomínat nemá.
 */
import { jePrechodna, VLNA } from "../steps/send-abandoned-notifications"

describe("upomínka na opuštěný košík — třídění chyb", () => {
  it("překročený limit Resendu je přechodný — zítra se zkusí znovu", () => {
    expect(
      jePrechodna(
        'Resend odmítl e-mail "abandoned-cart" pro t@t.cz: rate_limit_exceeded: ' +
          "Too many requests. You can only make 10 requests per second.: HTTP 429"
      )
    ).toBe(true)
  })

  it("výpadky sítě jsou přechodné", () => {
    expect(jePrechodna("FetchError: fetch failed")).toBe(true)
    expect(jePrechodna("connect ETIMEDOUT 1.2.3.4:443")).toBe(true)
    expect(jePrechodna("socket hang up")).toBe(true)
  })

  it("odmítnutá adresa je trvalá — košík se už upomínat nemá", () => {
    expect(
      jePrechodna(
        'Resend odmítl e-mail "abandoned-cart" pro jana.novakova@example.com: ' +
          "validation_error: Invalid `to` field. Please use our testing email " +
          "address instead of domains like `example.com`.: HTTP 422"
      )
    ).toBe(false)
  })

  it("neregistrovaná šablona je trvalá", () => {
    expect(
      jePrechodna('Nepodařilo se odeslat e-mail: šablona "neco" není zaregistrovaná.')
    ).toBe(false)
  })

  it("vlna se vejde pod strop deseti požadavků za sekundu", () => {
    expect(VLNA).toBeLessThan(10)
  })
})
