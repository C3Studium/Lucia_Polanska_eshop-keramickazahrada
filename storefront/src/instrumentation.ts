/**
 * Hlášení chyb obchodu do provozního deníku (3. 11. 2026).
 *
 * ## Proč to tu je
 *
 * Když na webu spadne stránka, dozví se to log na Railway a nikdo jiný.
 * Zákazník vidí chybovou stránku, my nevidíme nic — a tohle je ten druh
 * poruchy, o které se jinak dozvíme až tím, že někdo zavolá.
 *
 * `onRequestError` volá Next na každou nezachycenou chybu serverového
 * požadavku: stránky, serverových komponent i routních handlerů. Jedno místo
 * tedy pokryje celý web a nová stránka je hlášená ode dne, kdy vznikne.
 *
 * ## Co se neposílá
 *
 * Nic z obsahu požadavku — jen cesta, text chyby a zkrácená stopa. V tělech
 * a hlavičkách jdou osobní data a přihlašovací tokeny, a hlásič chyb je to
 * poslední místo, kde mají být.
 *
 * ## Proč to nikdy nic neshodí
 *
 * Chybová cesta je ta nejhorší možná chvíle na druhou chybu. Odeslání má
 * proto krátký časový strop, vlastní `catch` a nikdy se na ně nečeká dýl,
 * než je potřeba — když hlášení nedojde, zůstane aspoň chybová stránka
 * taková, jaká byla.
 */

type ChybovyKontext = {
  routerKind?: string
  routePath?: string
  routeType?: string
}

const adresaBackendu = (): string =>
  (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    ""
  ).replace(/\/+$/, "")

export async function onRequestError(
  error: unknown,
  request: { path?: string; url?: string },
  context: ChybovyKontext
): Promise<void> {
  const zaklad = adresaBackendu()
  const tajemstvi = (process.env.ADMIN_BRIDGE_SECRET ?? "").trim()

  /* Bez adresy nebo tajemství se nehlásí — doplněk provozu, ne podmínka. */
  if (!zaklad || !tajemstvi) return

  try {
    const zprava = String((error as Error)?.message ?? error).slice(0, 2000)
    const stopa = String((error as Error)?.stack ?? "")
      .split("\n")
      .slice(0, 8)
      .join("\n")
      .slice(0, 4000)

    await fetch(`${zaklad}/hooks/provoz`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tajemstvi}`,
      },
      body: JSON.stringify({
        kde: context?.routeType ?? context?.routerKind ?? "web",
        cesta: request?.path ?? request?.url ?? context?.routePath ?? "",
        zprava,
        stopa,
        uroven: "error",
      }),
      signal: AbortSignal.timeout(5_000),
    })
  } catch {
    /* Hlásič chyb nesmí být další chyba. */
  }
}
