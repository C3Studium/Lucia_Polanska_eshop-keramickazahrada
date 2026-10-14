/**
 * Znovu načíst detail objednávky po akci, která mění nativní objednávku
 * (plnění, odeslání, platba).
 *
 * Nativní části detailu — odznaky „Zaplaceno / Splněno" v záhlaví, Platby,
 * Nesplněné položky — běží na vlastním query klientu Medusy, který invalidace
 * našich widgetů nevidí. Bez obnovení zůstávaly viset na starém stavu
 * („Částečně zaplaceno, Nesplněno" u zaplacené #50, 14. 10. 2026). Malé
 * zpoždění, ať se hláška stihne ukázat.
 */
export const reloadOrderPageSoon = (delayMs = 1200) => {
  setTimeout(() => window.location.reload(), delayMs);
};
