import type { MetadataRoute } from "next"

/**
 * robots.txt — dřív tuhle cestu spolkla dynamická routa [countryCode] a
 * servírovala místo ní HTML domovské stránky. Roboti smí do katalogu a na
 * obsahové stránky; soukromé a procesní cesty (účet, košík, pokladna,
 * tokenové landingy) indexovat nemají co.
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://store.matejforejt.com").replace(/\/$/, "")

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/*/account",
          "/*/cart",
          "/*/checkout",
          "/*/express-checkout",
          "/*/order/",
          "/*/forgot-password",
          "/*/reset-password",
          "/*/verify-email",
          "/*/newsletter",
          "/*/results",
          "/*/search",
          "/api/",
          "/studio",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
