/**
 * Je obchod plátcem DPH?
 *
 * ## Dnes ne
 *
 * Lucia Polanská plátcem DPH není, takže žádnou daň neúčtuje. Souhrny přesto
 * ukazovaly řádek „Daně 0,-" a pod součtem „včetně DPH" — obojí tvrdilo, že
 * v ceně nějaká daň je. To je pro neplátce nepravda, a u částky, kterou
 * zákazník platí, je nepravda navíc špatně vypadající: řádek s nulou vypadá
 * jako by se něco nepovedlo spočítat.
 *
 * ## Až plátcem bude
 *
 * Přepnout tuhle jedinou hodnotu na `true`. Vrátí se tím zpátky:
 *
 * - řádek „Daně" v souhrnu košíku (`common/components/cart-totals`),
 * - týž řádek v plovoucí liště košíku (`cart/templates/checkout-bar`),
 * - poznámka „včetně DPH" pod celkovou částkou tamtéž a v rozbaleném košíku
 *   (`layout/components/cart-dropdown`),
 * - věta „Včetně DPH … Tolik zaplatíte." ve shrnutí před odesláním
 *   (`checkout/components/review/recap`),
 * - řádek „Daně" u hotové objednávky (`order/components/order-summary`
 *   a `order/templates/order-completed-template`).
 *
 * Samotné číslo počítá Medusa (`tax_total`) a je nedotčené — vypnutý je jen
 * jeho výpis. Není tedy co dopočítávat, jen zase ukázat.
 *
 * ## Co tímhle vypínačem NEPROJDE
 *
 * - **Nastavení daní v Meduse.** Tam se registrace k DPH taky musí promítnout,
 *   jinak bude `tax_total` po přepnutí pořád nula.
 * - **Faktury z iDokladu.** Ty si tahají svoje údaje odjinud.
 * - **Ceny dopravců na stránce Doprava a platba.** Tam se u každé služby píše
 *   „cena služby je 79 Kč včetně DPH". Je to cena dopravce, ne naše daň —
 *   větu je potřeba přepsat rozhodnutím o textu, ne příznakem, a nechal jsem
 *   ji proto být.
 */
export const PLATCE_DPH = false
