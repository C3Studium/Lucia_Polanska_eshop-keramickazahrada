/**
 * Jak recenze vznikají a co znamená štítek (§ 5 ZOS — obchod musí říct, jak
 * ověřuje, že recenzi píše skutečný zákazník, a nesmí mazat negativní).
 *
 * Musí sedět s tím, co dělá backend: recenzi pošle jen přihlášený zákazník
 * (`POST /store/reviews` vyžaduje účet), `verified_purchase` nastavuje server
 * podle objednávek (`workflows/steps/verify-review-purchase`) a každá recenze
 * čeká na ruční schválení. Stejné pravidlo píše WS-A do obchodních podmínek;
 * slib „negativní hodnocení nemažeme" je otevřená otázka pro majitelku
 * (sleduje orchestrátor) — změna tady = změna tam.
 */
export const REVIEW_POLICY_TEXT =
  "Recenze mohou psát přihlášení zákazníci. Štítek „Ověřený nákup“ má jen recenze od zákazníka, který si výrobek u nás koupil. Recenze schvalujeme ručně kvůli spamu a vulgaritám; negativní hodnocení nemažeme."
