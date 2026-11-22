/**
 * Ruční kontrola účtu Resend — před přechodem účtu a hned po něm (22. 11. 2026).
 *
 *   cd backend
 *   railway run --service Backend npm run check:resend
 *
 * `railway run` dosadí proměnné služby, ve které obchod běží (RESEND_API_KEY,
 * RESEND_FROM_EMAIL, případně RESEND_DOMAIN_ID). Vypíše jen verdikt, klíč ne.
 * Stejnou kontrolu dělá provozní hlídka každých 15 minut („Účet pro e-maily").
 *
 * Pozor: Railway dá běžícímu serveru proměnné z chvíle spuštění — změněný
 * klíč platí až po novém nasazení. Tenhle skript čte proměnné, ne běžící
 * server; o běžícím serveru řekne pravdu hlídka po nasazení.
 */
import { zkontrolujUcetResend } from "../src/lib/resend-ucet"

const main = async () => {
  const nalez = await zkontrolujUcetResend()
  const znak = nalez.stav === "ok" ? "✓" : nalez.stav === "nenastaveno" ? "–" : "✗"
  console.log(`${znak} Účet pro e-maily (Resend): ${nalez.zprava}`)
  for (const radek of nalez.detail ?? []) console.log(`   ${radek}`)
  process.exitCode = nalez.stav === "chyba" ? 1 : 0
}

void main()
