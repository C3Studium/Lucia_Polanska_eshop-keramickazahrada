/**
 * Česká hláška k neplatnému poli (14. 11. 2026).
 *
 * Dřív hlídal povinná pole prohlížeč sám: malá bublina u pole, jeho vlastními
 * slovy, po chvíli zmizela. Teď pole pod sebou napíše, co je špatně, a zůstane
 * to vidět, dokud se nezačne psát — viz `common/components/input`.
 */
export const zpravaProPole = (
  validity: ValidityState,
  type: string | undefined,
  options: { minLength?: number; vlastni?: string } = {}
): string | null => {
  if (validity.valid) return null
  if (validity.customError && options.vlastni) return options.vlastni
  if (validity.valueMissing) return "Vyplňte prosím toto pole."
  if (validity.typeMismatch && type === "email") return "Zadejte e-mail ve tvaru jmeno@domena.cz."
  if (validity.typeMismatch) return "Zkontrolujte prosím, jestli je to napsané správně."
  if (validity.tooShort) {
    return options.minLength
      ? `Zadejte aspoň ${options.minLength} znaků.`
      : "Text je příliš krátký."
  }
  if (validity.tooLong) return "Text je příliš dlouhý."
  if (validity.patternMismatch || validity.badInput) {
    return "Zkontrolujte prosím, jestli je to napsané správně."
  }
  if (validity.rangeUnderflow || validity.rangeOverflow || validity.stepMismatch) {
    return "Tahle hodnota tu nejde použít."
  }
  return "Zkontrolujte prosím toto pole."
}
