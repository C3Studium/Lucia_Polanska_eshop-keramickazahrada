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
import { TEXTY_DEFAULTS } from "@lib/constants/texty"

/* Výchozí znění; co platí doopravdy, si vezme komponenta z `useTexty()`
   (administrace → Právní věci a texty → Texty obchodu). */
export const REVIEW_POLICY_TEXT = TEXTY_DEFAULTS["produkt.recenze_pravidla"]
