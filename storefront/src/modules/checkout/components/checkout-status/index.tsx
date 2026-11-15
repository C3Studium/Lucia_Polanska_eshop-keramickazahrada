import LocalizedClientLink from "@modules/common/components/localized-client-link"
import styles from "./style.module.scss"

/**
 * Stav zákazníka hned pod kroky pokladny (15. 11. 2026, Matěj: „dej stavové
 * věci tam, kde dávají smysl").
 *
 * - Host: jedna věta s odkazem na přihlášení — kdo účet má, nemusí adresu
 *   psát znovu; po přihlášení se vrátí sem do pokladny.
 * - Přihlášený: komu se objednávka uloží, ať je jasné, že je to jeho účet.
 * - Dovolená: dřív až v posledním kroku, kdy už měl člověk všechno vyplněné.
 *   Lhůta doručení ho zajímá na začátku. Platbu neblokuje.
 */
export default function CheckoutStatus({
  customerEmail,
  vacationNotice,
}: {
  customerEmail?: string | null
  vacationNotice?: string | null
}) {
  return (
    <div className={styles.root}>
      {customerEmail ? (
        <p className={styles.line}>
          Nakupujete jako <strong>{customerEmail}</strong> — objednávku najdete ve svém účtu.
        </p>
      ) : (
        <p className={styles.line}>
          Máte u nás účet?{" "}
          <LocalizedClientLink href="/account?redirectTo=/checkout" className={styles.link}>
            Přihlaste se
          </LocalizedClientLink>{" "}
          a adresu vám doplníme. Jinak klidně pokračujte bez účtu.
        </p>
      )}
      {vacationNotice ? (
        <p className={styles.vacation} role="status">
          {vacationNotice}
        </p>
      ) : null}
    </div>
  )
}
