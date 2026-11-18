import { prihlasit } from "@lib/server/live-bus"
import { BUILD_STAMP } from "@lib/util/session-version"

/**
 * Živé spojení se záložkou (Server-Sent Events) — viz `lib/server/live-bus`.
 *
 * Hned po připojení pošle `hello` s otiskem verze obchodu. Při nasazení
 * nové verze se spojení přeruší, prohlížeč se sám připojí znovu a z nového
 * `hello` pozná, že běží nová verze — bez pravidelného dotazování.
 * Pak čeká na `changed` (uložení v administraci → `/api/revalidate`).
 *
 * Každých 25 s jde komentář, aby proxy (Railway, Cloudflare) nečinné
 * spojení nezavřela.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request) {
  const encoder = new TextEncoder()
  let odhlasit: (() => void) | null = null
  let ping: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const poslat = (udalost: string, data: string) =>
        controller.enqueue(encoder.encode(`event: ${udalost}\ndata: ${data}\n\n`))

      // Při výpadku se prohlížeč připojí znovu za 3 s.
      controller.enqueue(encoder.encode(`retry: 3000\n\n`))
      poslat("hello", JSON.stringify({ stamp: BUILD_STAMP }))
      odhlasit = prihlasit(poslat)
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          // Zavřené spojení — úklid obstará `cancel`/abort.
        }
      }, 25_000)

      request.signal.addEventListener("abort", () => {
        odhlasit?.()
        if (ping) clearInterval(ping)
        try {
          controller.close()
        } catch {}
      })
    },
    cancel() {
      odhlasit?.()
      if (ping) clearInterval(ping)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Ať proxy (nginx a spol.) spojení nebufferuje.
      "X-Accel-Buffering": "no",
    },
  })
}
