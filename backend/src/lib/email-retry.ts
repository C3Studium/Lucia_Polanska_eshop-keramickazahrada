/**
 * Automatické opakování nezdařených e-mailů (22. 11. 2026).
 *
 * 21. 11. při přepnutí účtu Resend vrátil Resend na jedno „Odesláno"
 * zákaznici HTTP 403 („keramickazahrada.cz domain is not verified"). Záznam
 * dostal `status = failure`, úloha `watch-failed-emails` to nahlásila
 * vývojáři — a e-mail ležel 15 hodin, než ho někdo v adminu „Poslal znovu".
 * Krátký výpadek (klíč, doména, kvóta, síť) nesmí znamenat ztracený e-mail.
 *
 * Opakuje se stejně jako tlačítko „Poslat znovu" (`api/admin/notifications/
 * [id]/retry`): NOVÝ záznam s klíčem `…:r2`, `…:r3` a odkazem na původní přes
 * `original_notification_id`, takže každý pokus zůstane vidět. Řetěz = původní
 * záznam + všechny jeho pokusy (ruční i automatické); opakuje se jen jeho
 * POSLEDNÍ pokus, a jen když ještě žádný neprošel.
 */

/** Odstupy (minuty) od posledního nezdařeného pokusu: 2., 3. a 4. pokus. */
export const RETRY_DELAYS_MIN = [10, 60, 360] as const

/** Kolik pokusů celkem (původní + opakování). */
export const MAX_ATTEMPTS = RETRY_DELAYS_MIN.length + 1

export const nextAttemptKey = (key: string | null | undefined): string | undefined => {
  if (!key) {
    return undefined
  }
  const match = key.match(/^(.*):r(\d+)$/)
  if (match) {
    return `${match[1]}:r${Number(match[2]) + 1}`
  }
  return `${key}:r2`
}

/** Pořadí pokusu podle klíče: bez přípony 1, `…:r3` je 3. */
export const attemptOf = (key: string | null | undefined): number => {
  const match = key?.match(/:r(\d+)$/)
  return match ? Number(match[1]) : 1
}

export type RetryCandidate = {
  id: string
  channel?: string | null
  to?: string | null
  status?: string | null
  idempotency_key?: string | null
  original_notification_id?: string | null
  created_at: Date | string
}

const time = (value: Date | string) => new Date(value).getTime()

/**
 * Co poslat znovu teď (`retry`) a které řetězy vyčerpaly všechny pokusy
 * (`exhausted`, jen k nahlášení). Vstup jsou e-mailové záznamy z posledních
 * hodin VČETNĚ úspěšných — podle nich se pozná, že řetěz mezitím prošel.
 */
export function planEmailRetries<T extends RetryCandidate>(
  notifications: T[],
  now: Date
): { retry: T[]; exhausted: T[] } {
  const chains = new Map<string, T[]>()
  for (const notification of notifications) {
    if (notification.channel !== "email" || !String(notification.to ?? "").trim()) continue
    const root = notification.original_notification_id || notification.id
    chains.set(root, [...(chains.get(root) ?? []), notification])
  }

  const retry: T[] = []
  const exhausted: T[] = []
  for (const chain of chains.values()) {
    if (chain.some((item) => item.status === "success")) continue
    const latest = [...chain].sort(
      (a, b) => attemptOf(b.idempotency_key) - attemptOf(a.idempotency_key) || time(b.created_at) - time(a.created_at)
    )[0]
    if (latest.status !== "failure") continue

    const attempt = attemptOf(latest.idempotency_key)
    if (attempt >= MAX_ATTEMPTS) {
      exhausted.push(latest)
      continue
    }
    const waitMin = RETRY_DELAYS_MIN[attempt - 1]
    if (now.getTime() - time(latest.created_at) >= waitMin * 60_000) {
      retry.push(latest)
    }
  }
  return { retry, exhausted }
}
