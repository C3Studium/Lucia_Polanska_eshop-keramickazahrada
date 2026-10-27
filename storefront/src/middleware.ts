import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"
import { studioPreviewNeedsResolve, studioPreviewPageFor } from "@lib/studio-preview/pages"

// Prefer server-side URL, then public; normalize trailing slash
const RAW_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
const BACKEND_URL = RAW_BACKEND_URL?.replace(/\/$/, "")
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    throw new Error(
      "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
    )
  }

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
    const url = `${BACKEND_URL}/store/regions`
    const res = await fetch(url, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY!,
      },
      next: {
        revalidate: 3600,
        tags: [`regions-${cacheId}`],
      },
      cache: "force-cache",
    })

    const ctype = res.headers.get("content-type") || ""
    const text = await res.text()
    let parsed: any
    if (!ctype.includes("application/json")) {
      throw new Error(
        `Expected JSON from ${res.url} but got ${ctype || "unknown"}: ${text.slice(
          0,
          200
        )}`
      )
    }
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      throw new Error(`Failed to parse JSON from ${res.url}: ${text.slice(0, 200)}`)
    }

    if (!res.ok) {
      throw new Error(parsed?.message || JSON.stringify(parsed))
    }

    const { regions } = parsed

    if (!regions?.length) {
      throw new Error(
        "No regions found. Please set up regions in your Medusa Admin."
      )
    }

    // Create a map of country codes to regions. A country without an iso code
    // must not create a "" key — a blank countryCode downstream turned the
    // fallback response into a redirect to the very same URL.
    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        if (c.iso_2) {
          regionMapCache.regionMap.set(c.iso_2, region)
        }
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Error getting the country code. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
      )
    }
  }
}

/**
 * Ukázkové stránky Studia (`@lib/studio-preview/pages`).
 *
 * - `fixed` (stavy newsletteru) → přepis bez dotazu, pro kohokoli — stránka by
 *   tentýž stav ukázala i s `?stav=` v adrese.
 * - ostatní jen pro požadavek s cookie Studia (`cms_session`) — každý jiný
 *   požadavek projde bez jediného dotazu navíc. Jestli je session platná,
 *   rozhodne až `/api/studio/ukazka` (Node, ValeCMS); middleware běží na Edge
 *   a session ověřit neumí. Odpověď:
 *   - `target` → přepis (adresa v rámu Studia zůstane vyhrazená),
 *   - `cookies` → vloží se do cookies TOHOTO požadavku (ukázkový košík, token
 *     ukázkového zákazníka); prohlížeč je nedostane, takže v rámu jde jen koukat,
 *   - `missing` → krátké vysvětlení místo cizí 404,
 *   - cokoli jiného (není redaktor, chyba) → normální cesta, jako by tu tohle nebylo.
 */
const withCookies = (request: NextRequest, extra: Record<string, string> | undefined): Headers => {
  const headers = new Headers(request.headers)
  if (!extra || !Object.keys(extra).length) return headers
  const kept = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !Object.hasOwn(extra, part.split("=")[0]))
  headers.set("cookie", [...kept, ...Object.entries(extra).map(([name, value]) => `${name}=${value}`)].join("; "))
  return headers
}

async function resolveStudioPreview(request: NextRequest): Promise<NextResponse | null> {
  const page = studioPreviewPageFor(request.nextUrl.pathname)
  if (!page) return null
  if (page.fixed) {
    return NextResponse.rewrite(new URL(page.fixed, request.nextUrl.origin))
  }
  if (!studioPreviewNeedsResolve(page) || !request.cookies.get("cms_session")?.value) return null
  // Redaktor s vlastním košíkem vidí ten svůj.
  if (page.cart && request.cookies.get("_medusa_cart_id")?.value) return null

  const origin = process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : request.nextUrl.origin
  let answer: { target?: string; cookies?: Record<string, string>; missing?: string } | null = null
  try {
    const res = await fetch(
      `${origin}/api/studio/ukazka?p=${encodeURIComponent(page.path)}`,
      { headers: { cookie: request.headers.get("cookie") ?? "" }, cache: "no-store" }
    )
    if (res.status === 404) return null
    answer = await res.json().catch(() => null)
  } catch {
    return null
  }
  if (!answer) return null

  if (answer.target) {
    return NextResponse.rewrite(new URL(answer.target, request.nextUrl.origin), {
      request: { headers: withCookies(request, answer.cookies) },
    })
  }
  if (answer.cookies) {
    return NextResponse.next({ request: { headers: withCookies(request, answer.cookies) } })
  }
  const what = String(answer.missing ?? "ukázková data").replace(/[<>&"]/g, "")
  return new NextResponse(
    `<!doctype html><html lang="cs"><meta charset="utf-8"><title>Ukázka — chybí data</title>` +
      `<body style="font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 16px;color:#2b2622">` +
      `<h1 style="font-size:1.25rem">Tahle ukázka zatím nemá data</h1>` +
      `<p>Stránka se ukazuje na skutečných datech z obchodu a chybí: <strong>${what}</strong>. ` +
      `Až v obchodě vznikne, ukázka se tu objeví sama.</p></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  )
}

/**
 * Middleware to handle region selection and onboarding status.
 */
export async function middleware(request: NextRequest) {
  // If the request is for the studio, we skip the middleware.
  if ( request.nextUrl.pathname.startsWith("/studio")) {
    return NextResponse.next()
  }

  const studioPreview = await resolveStudioPreview(request)
  if (studioPreview) {
    return studioPreview
  }

  let cacheIdCookie = request.cookies.get("_medusa_cache_id")

  let cacheId = cacheIdCookie?.value || crypto.randomUUID()

  /*
   * A backend hiccup must not take the whole site down. `getRegionMap` throws
   * on any fetch failure, and an uncaught throw here is a 500 on EVERY route —
   * static pages included. Degrade instead: pass the request through and let
   * the page's own data layer (with its own error handling) deal with it.
   */
  let regionMap: Map<string, HttpTypes.StoreRegion> | null = null
  try {
    regionMap = await getRegionMap(cacheId)
  } catch (error) {
    console.error("Middleware: regions unavailable, passing request through.", error)
    return NextResponse.next()
  }

  const countryCode = regionMap && (await getCountryCode(request, regionMap))

  // Without a resolvable country there is nothing to redirect TO — pass the
  // request through instead of bouncing it back at its own URL.
  if (!countryCode) {
    return NextResponse.next()
  }

  // Exact segment match — `includes` let „/czech-pottery" pass as „cz".
  const urlHasCountryCode =
    request.nextUrl.pathname.split("/")[1]?.toLowerCase() === countryCode

  /*
   * Signed-out visitors are sent back to /account, which is where the login form lives.
   *
   * The account area protects itself through parallel routes: the layout picks the `@login` slot
   * when there is no customer. That works at /account itself and nowhere below it — `@login` has
   * a single `page.tsx` and no segment for `wishlist`, `orders`, `profile` and the rest, so on a
   * request straight to /account/wishlist there is no slot to render and the page comes back
   * broken rather than as a login form. Which is what „wishlist neroutuje" is.
   *
   * The cookie is the gate here rather than the customer, because middleware has no session to
   * ask — a JWT that exists but has expired still gets through, and the layout catches that on
   * the server. So this is the redirect, not the authorisation; `default.tsx` in the slots covers
   * the same case for client-side navigation and for a stale token.
   */
  if (urlHasCountryCode) {
    const segments = request.nextUrl.pathname.split("/").filter(Boolean)
    const isBelowAccountRoot = segments[1] === "account" && segments.length > 2

    if (isBelowAccountRoot && !request.cookies.get("_medusa_jwt")?.value) {
      const loginUrl = new URL(`/${countryCode}/account`, request.nextUrl.origin)

      return NextResponse.redirect(loginUrl, 307)
    }
  }

  // if one of the country codes is in the url and the cache id is set, return next
  if (urlHasCountryCode && cacheIdCookie) {
    return NextResponse.next()
  }

  /*
   * URL už kód země má, jen chybí cache cookie. Dřív se tu odpovídalo
   * redirectem NA TUTÉŽ URL, aby další požadavek přišel s cookie — jenže
   * klient, který cookies nevrací (Googlebot, curl), se tak točil v nekonečné
   * smyčce 307 a web byl pro roboty neindexovatelný. Cookie stačí nastavit
   * na průchozí odpovědi: první render poběží bez cache-id tagu (neškodné),
   * každý další požadavek už cookie nese.
   */
  if (urlHasCountryCode && !cacheIdCookie) {
    const passThrough = NextResponse.next()
    passThrough.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })

    return passThrough
  }

  // check if the url is a static asset
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  // If no country code is set, we redirect to the relevant region — and the
  // cache cookie rides along, so the redirected request needs no second hop.
  if (!urlHasCountryCode && countryCode) {
    const redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    const redirect = NextResponse.redirect(redirectUrl, 307)
    if (!cacheIdCookie) {
      redirect.cookies.set("_medusa_cache_id", cacheId, {
        maxAge: 60 * 60 * 24,
      })
    }
    return redirect
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
