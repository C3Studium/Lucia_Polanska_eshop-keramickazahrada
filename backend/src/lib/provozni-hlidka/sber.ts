import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { zapisProvoz, type DruhProvozu } from "./zapis"

/**
 * Sběr provozu z HTTP (3. 11. 2026).
 *
 * ## Proč jedno místo, a ne zápis v každé funkci
 *
 * „Trackovat každou funkci" se nedá udělat tak, že se do každé dopíše řádek:
 * funkcí jsou stovky, nová by zápis neměla a za měsíc by deník lhal tím, co
 * v něm NENÍ. Každá akce administrace i obchodu ale prochází jedním HTTP
 * požadavkem — uložení produktu, přesun, schválení reklamace, přihlášení,
 * dokončení košíku. Stačí tedy sbírat tady a nová funkce je v deníku ode dne,
 * kdy vznikne, aniž by si na to kdokoli vzpomněl.
 *
 * ## Co se nezapisuje, a to schválně
 *
 * **Těla požadavků ne.** Jdou v nich hesla, platební údaje a osobní data,
 * a deník je to poslední místo, kde mají ležet měsíc. Na dohledání chyby
 * stačí cesta, stav, trvání a identifikátor.
 *
 * **Čtení (GET) ne, dokud neselže.** Jinak by devět desetin deníku bylo
 * prohlížení administrace a to podstatné by se v tom utopilo.
 *
 * ## Proč se zapisuje po odpovědi
 *
 * `res.on("finish")` běží, až když je odpověď u klienta. Zápis tedy nemůže
 * nic zdržet a nemůže nic shodit — a to je podmínka, za které smí pozorovatel
 * sedět na kritické cestě platby.
 */

/** Konec cesty bez dotazu. */
const cesta = (req: MedusaRequest): string =>
  String(req.originalUrl ?? req.url ?? "").split("?")[0]

/**
 * Identifikátory v cestě nahradí `:id`, aby se dalo počítat „kolikrát dnes
 * se ukládal produkt". Bez toho má každý produkt vlastní akci a souhrn je
 * seznam náhodných řetězců.
 */
export const normalizujCestu = (cesta: string): string =>
  cesta
    .split("/")
    .map((segment) => {
      if (!segment) return segment
      /* `order_01J…`, `prod_…`, `ae_…` — Medusa dává předponu a podtržítko. */
      if (/^[a-z]{2,8}_[0-9A-Za-z]{10,}$/.test(segment)) return ":id"
      /* Čisté číslo (např. číslo objednávky) i dlouhý token nebo UUID. */
      if (/^\d+$/.test(segment)) return ":id"
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) return ":id"
      if (segment.length >= 24 && !segment.includes("-")) return ":id"
      return segment
    })
    .join("/")

/**
 * Druh podle cesty. Pořadí rozhoduje — první shoda vyhrává, takže
 * konkrétnější pravidla (reklamace v objednávce) stojí před obecnými.
 */
const PRAVIDLA: Array<{ vzor: RegExp; druh: DruhProvozu }> = [
  { vzor: /\/hooks\/idoklad/, druh: "faktura" },
  { vzor: /\/hooks\/payment/, druh: "platba" },
  { vzor: /\/hooks\/newsletter/, druh: "email" },
  { vzor: /(claims|return-request|reklamace|refund)/, druh: "reklamace" },
  { vzor: /(gift-vouchers?|poukaz)/, druh: "poukaz" },
  { vzor: /(made-to-order|production|zakazk)/, druh: "zakazka" },
  { vzor: /(courses?|kurz)/, druh: "kurz" },
  { vzor: /(payment|platba|comgate)/, druh: "platba" },
  { vzor: /(newsletter|emails?)/, druh: "email" },
  { vzor: /\/(auth|session)/, druh: "prihlaseni" },
  { vzor: /\/store\/customers\/me/, druh: "prihlaseni" },
  { vzor: /\/store\/(carts|orders)/, druh: "obchod" },
  { vzor: /^\/admin\//, druh: "admin" },
  { vzor: /^\/store\//, druh: "obchod" },
]

export const druhZCesty = (cesta: string): DruhProvozu => {
  for (const pravidlo of PRAVIDLA) {
    if (pravidlo.vzor.test(cesta)) return pravidlo.druh
  }
  return "obchod"
}

/**
 * Kdo to udělal. Jen identifikátor přihlášeného uživatele — nikdy jméno ani
 * e-mail: na dohledání stačí id a deník není evidence lidí.
 */
const kdo = (req: MedusaRequest): string => {
  const context = (req as unknown as Record<string, unknown>).auth_context as
    | { actor_id?: string; actor_type?: string }
    | undefined

  if (context?.actor_id) {
    return `${context.actor_type ?? "actor"}:${context.actor_id}`
  }
  return "nepřihlášený"
}

/** Cesty, které se nezapisují ani při změně — jinak deník hlásí sám sebe. */
const TICHE = [
  /^\/admin\/operations\/provoz/,
  /^\/health/,
  /^\/admin\/notifications/,
]

/**
 * Zapisovač provozu. Nasazuje se v `api/middlewares.ts` na `/admin/*`
 * a `/store/*` pro všechny metody.
 */
export const zapisovacProvozu = () =>
  function zapisovacProvozuMiddleware(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ): void {
    const start = Date.now()
    const url = cesta(req)
    const metoda = String(req.method ?? "GET").toUpperCase()

    if (TICHE.some((vzor) => vzor.test(url))) {
      next()
      return
    }

    res.on("finish", () => {
      const stavKod = Number(res.statusCode ?? 0)
      const selhalo = stavKod >= 400

      /* Čtení se zapisuje jen tehdy, když selže — viz hlavička. */
      if (metoda === "GET" && !selhalo) return

      /* 401 a 404 na čtení jsou běžný provoz prohlížeče (vypršelá relace,
         zahozená záložka), ne porucha; 5xx je porucha vždy. */
      if (metoda === "GET" && stavKod < 500) return

      const normalizovana = normalizujCestu(url)

      void zapisProvoz(req.scope, {
        druh: druhZCesty(url),
        akce: `${metoda} ${normalizovana}`,
        stav: selhalo ? "chyba" : "ok",
        kdo: kdo(req),
        popis: selhalo ? `odpověď ${stavKod}` : null,
        detail: selhalo
          ? { stav: stavKod, cesta: url, metoda }
          : null,
        trvaloMs: Date.now() - start,
      })
    })

    next()
  }
