import { getShippingPriceList, type ShippingPriceOption } from "./data"
import styles from "./style.module.scss"

/**
 * Živý ceník dopravy na stránce „Doprava a platba" (serverová komponenta).
 *
 * Ceny se do textu nepíšou — stránka je bere z backendu, takže nemůže
 * tvrdit něco jiného než pokladna (dřív tu stály dvě sady cen, které si
 * odporovaly). Když backend neodpoví, ukáže se věta s odkazem do košíku:
 * ceník, který si vymýšlí, je horší než žádný.
 *
 * Vykresluje se jako `supplement` kapitoly `cenik` uvnitř `LegalDocument`,
 * takže tabulky přebírají styl dokumentu (`.chapterBody table`).
 */

const COUNTRY_NAMES: Record<string, string> = {
  cz: "Česká republika",
  sk: "Slovensko",
}

const countryName = (code: string): string => {
  if (COUNTRY_NAMES[code]) return COUNTRY_NAMES[code]
  try {
    return new Intl.DisplayNames(["cs"], { type: "region" }).of(code.toUpperCase()) ?? code
  } catch {
    return code.toUpperCase()
  }
}

/** „79 Kč", „3,50 €" — celé částky bez haléřů, ostatní na dvě místa. */
const money = (amount: number, currency: string): string => {
  const whole = Math.round(amount * 100) % 100 === 0
  try {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount} ${currency.toUpperCase()}`
  }
}

const priceOf = (option: ShippingPriceOption, currency: string): string => {
  if (option.price_type === "calculated" || option.amount === null) {
    return "spočítá se v pokladně"
  }
  if (option.amount === 0) return "zdarma"
  return money(option.amount, currency)
}

const noteOf = (option: ShippingPriceOption, currency: string): string => {
  const notes: string[] = []
  if (option.free_from !== null && option.amount !== 0) {
    notes.push(`zdarma při nákupu od ${money(option.free_from, currency)}`)
  }
  if (option.type === "pickup") notes.push("vyzvednutí v ateliéru po domluvě")
  return notes.join(" · ")
}

export default async function ShippingPrices({ countryCode }: { countryCode: string }) {
  const list = await getShippingPriceList()
  const countries = list?.countries.filter((country) => country.options.length) ?? []

  if (!countries.length) {
    return (
      <div className={styles.fallback} role="note">
        <p>
          Aktuální ceník se teď nepodařilo načíst. Ceny dopravy uvidíte vždy
          v pokladně — po zadání adresy se ukážou všechny možnosti i s cenou,
          ještě než objednávku odešlete.{" "}
          <a href={`/${countryCode}/cart`}>Přejít do košíku</a>
        </p>
      </div>
    )
  }

  const hasFreeShipping = countries.some((country) =>
    country.options.some((option) => option.free_from !== null)
  )

  return (
    <div className={styles.prices}>
      {countries.map((country) => {
        const currency = country.currency_code
        const caption = `${countryName(country.country_code)} — ceny v ${
          currency === "czk" ? "korunách" : currency === "eur" ? "eurech" : currency.toUpperCase()
        }`
        return (
          <div
            key={country.country_code}
            className={styles.tableScroll}
            role="region"
            aria-label={caption}
            tabIndex={0}
          >
            <table>
              <caption>{caption}</caption>
              <thead>
                <tr>
                  <th scope="col">Způsob doručení</th>
                  <th scope="col">Cena</th>
                  <th scope="col">Poznámka</th>
                </tr>
              </thead>
              <tbody>
                {country.options.map((option) => (
                  <tr key={option.id}>
                    <th scope="row">{option.name}</th>
                    <td>{priceOf(option, currency)}</td>
                    <td>{noteOf(option, currency) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {list?.dobirka_fee_czk ? (
        <p>
          <strong>Doběrečné</strong> (platba na dobírku, jen Česká pošta na adresu
          v České republice): {money(list.dobirka_fee_czk, "czk")}.
        </p>
      ) : null}

      {hasFreeShipping ? (
        <p className={styles.small}>
          Hranice pro dopravu zdarma se počítá z hodnoty položek v košíku, bez ceny dopravy.
        </p>
      ) : null}
    </div>
  )
}
