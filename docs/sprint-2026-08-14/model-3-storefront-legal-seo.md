# Model 3 — Storefront: legal compliance + SEO

You are working in `/Users/matejforejt/Documents/GitHub/Lucia_Polanska_eshop-keramickazahrada/storefront`
(Next.js 15 App Router, React 19, TypeScript, SCSS modules — design system in
`src/styles/system/`, NOT tailwind config). Czech ceramics e-shop (owner Lucie
Polanská, sole trader), launching 09/2026. All customer-facing text Czech, code
and comments English. Do NOT commit — leave changes in the working tree. Do NOT
add npm dependencies; do NOT edit `package.json` (app-router native `robots.ts`
/ `sitemap.ts` / `opengraph-image.tsx` need none).

Three other models work in this repo in parallel. **File ownership — you may edit:**
- `src/app/[countryCode]/(main)/{smluvni-podminky,ochrana-osobnich-udaju,cookies,odstoupeni-od-smlouvy,doprava-a-platba,reklamacni-protokol}/**`
- `src/lib/data/merchant.ts`, `src/lib/util/env.ts`
- `src/modules/layout/Footer/**`, `src/modules/layout/CookieNotice/**`
- `src/modules/express-checkout/**`
- `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/opengraph-image.tsx` (new),
  `src/app/layout.tsx` (metadata only), `next-sitemap.js` (delete)
- `generateMetadata` additions in `src/app/[countryCode]/(main)/{store,collections,categories,search,results}/**`

Do NOT touch: checkout module (`src/modules/checkout/**` — the terms checkbox
there is already done and correct), account pages, error/not-found pages,
`next.config.js`, `check-env-variables.js`, Sanity code, navbar. If a task
seems to need them, note it in your report instead.

Read every file before editing. Legal texts you write must be current Czech
law (OZ 89/2012 Sb. post-374/2022, GDPR, ZOS 634/1992 Sb.) and honest about
this specific shop. Where only Lucia/a lawyer can decide, insert a visible
`{/* POTVRDIT: … */}` comment, choose the safe default, and list it in your
final report.

## A. Obchodní podmínky — `smluvni-podminky/data.ts`

The current text is a 2015 template with unfilled blanks in binding clauses:
1. ~line 36: „kliknutím na tlačítko „ ‟" — name the real button. Find the
   actual label on the checkout pay button (`src/modules/checkout/components/review/`
  — read-only) and use it verbatim.
2. ~line 106: mimosoudní stížnosti e-mail — use the merchant e-mail from
   `src/lib/data/merchant.ts`.
3. ~line 116: the personal-data enumeration cut off mid-sentence — complete it.
4. ~line 115: replace repealed „zákon č. 101/2000 Sb." with GDPR + zákon
   č. 110/2019 Sb.
5. ~line 107: add the mandatory ADR clause — ČOI as ADR body with adr.coi.cz,
   plus the EU ODR platform (ec.europa.eu/consumers/odr) mention.
6. ~line 141-142: date „1.1. 2015" / „V Písku" → current date and the real
   place of business from merchant.ts.
7. ~line 56: bank accounts — use ONLY the account from `merchant.ts` (single
   source of truth; Matěj sets the real number there — flag with POTVRDIT).
8. Withdrawal/MTO: state the § 1837 písm. d) exception for zboží vyrobené
   podle požadavků spotřebitele (zakázková výroba) — this shop sells
   commissions; the terms must say withdrawal doesn't apply to them, matching
   what the product pages already communicate.
9. ~line 81-82: resolve the embedded TODO about the claim form — link
   `/reklamacni-protokol`.
10. Keep the document structure/route as is (`/smluvni-podminky`); make sure
    the version constant the checkout consent records (`TERMS_VERSION` in the
    checkout review component — read-only) still matches; if the version needs
    bumping after this rewrite, say so in the report (do not edit checkout).

## B. Ochrana osobních údajů — rewrite for reality

`ochrana-osobnich-udaju/page.tsx` is corporate boilerplate („Jsme
společnost…", „společnosti v rámci naší skupiny"). Rewrite as the sole trader
Lucie Polanská (identification from merchant.ts), with the REAL processor list:
Railway (hosting), ComGate (platby), Česká pošta/Balíkovna a Zásilkovna
(doprava), Resend (transakční e-maily), Sanity (obsah webu), MinIO/úložiště
(fotky), případně Segment (analytika — POTVRDIT, see D). Purposes, legal bases,
retention; the full rights list INCLUDING the right to complain to ÚOOÚ
(www.uoou.cz) — currently missing, mandatory under Art. 13(2)(d). Keep the
existing page component/styling conventions; content only needs to change.

## C. Cookies page + banner — one truth

`cookies/page.tsx` claims Google Analytics + a cookie-settings UI that don't
exist; the banner (`src/modules/layout/CookieNotice/`) says „Nesledujeme vás".
The codebase has NO analytics. Make everything tell the banner's truth:
- rewrite the cookies page: only technical/necessary cookies (list the real
  ones: cart id, auth session, cookie-notice acknowledgement, localStorage
  keys), no third-party analytics, no „nastavení cookies" claim;
- delete the stub section whose body is the single word „Cookies";
- fix the „změnit souhlas na konci této stránky" claim (either add a simple
  „znovu zobrazit lištu" button that clears the localStorage key, or drop the
  sentence — the button is better and trivial);
- keep the banner as an informational notice (it is correct today). Add a
  comment: the day analytics is added it must become a consent manager.

## D. Odstoupení od smlouvy — page with substance

`odstoupeni-od-smlouvy/page.tsx` is only the blank form. Add the prose the
metadata already promises: the 14-day right (§ 1829), how the deadline counts,
how to send it (e-mail/post to merchant.ts addresses), refund within 14 days
incl. cheapest delivery cost, customer pays return shipping, the § 1837
exceptions (zakázková výroba!), and keep the form below with a print-friendly
treatment (`@media print` styles so it can be printed and mailed).

## E. Doprava a platba — one price list, no dead providers

`doprava-a-platba/page.tsx` publishes contradictory duplicated sections
(79 vs 89 Kč výdejní místa; 95/99/99 Kč adresa; a literal „(CZ, varianta 2)"
title) and „PlatímPak … Equa Bank, a.s." — a bank that no longer exists, for a
method the checkout doesn't offer. Rebuild the page data as ONE table matching
what checkout actually offers: Balíkovna (výdejní místo), Balík Do ruky,
Zásilkovna (POTVRDIT — may be dropped), Osobní odběr (0 Kč), payments ComGate
(karta), dobírka, platba při vyzvednutí. Prices: use the currently configured
shipping-option prices — verify them via the store API if reachable, otherwise
mark each price `{/* POTVRDIT cenu */}` and use the value from the checkout UI
code. Remove empty divider sections with `paragraphs: []` or give them content.

## F. Reklamační řád — naming consistency

One document lives under three names (odkazy říkají „reklamační řád", route je
`/reklamacni-protokol`). Pick the clean structure: `/reklamacni-protokol` stays
the claim FORM page (with the PDF slot — `download.tsx` `PROTOCOL_PDF_PATH`
stays null until Lucia supplies the PDF; keep the honest „dokončujeme" note),
and add the actual reklamační řád content (rights per § 2165+ OZ: 2 roky,
30-day resolution, remedies ladder post-2023) either as a section of the terms
(A) or its own short page — then make every link label match what it points to
(footer links you own; the carrier-damage link text is in
`src/modules/order/components/carrier-damage/` — read-only, report if its label
needs changing).

## G. Express checkout — consent + dead-end fix

`src/modules/express-checkout/Payment/index.tsx` (~line 202-210):
1. Add a mandatory checkbox „Souhlasím s obchodními podmínkami a beru na
   vědomí zpracování osobních údajů" with links to both documents, gating the
   pay button — mirror the pattern and consent-recording of the main checkout
   (`recordConsent` writing cart metadata with `TERMS_VERSION` — read the main
   checkout implementation read-only and replicate it inside express-checkout).
2. The empty-gateway dead end („Comgate teď není dostupný" with no way out):
   add a fallback link to the standard cart/checkout so the customer is never
   stranded.

## H. Newsletter signup compliance (Footer)

`src/modules/layout/Footer/` newsletter block: turn the plain consent sentence
into an unchecked checkbox („Souhlasím se zasíláním novinek…") required before
subscribe, with a link to `/ochrana-osobnich-udaju`. Mention odhlášení v každém
e-mailu. Keep the existing visual language (SCSS module, no new patterns).

## I. SEO — robots, sitemap, OG, metadata

1. Delete dead `next-sitemap.js` (the package isn't installed; the config was
   never run). Create native `src/app/robots.ts` + `src/app/sitemap.ts`:
   - robots: keyed on `NEXT_PUBLIC_SITE_ENV` — `production` allows all (still
     disallow `/studio`, `/api`, checkout/account routes), anything else
     disallows everything (staging must not be indexed);
   - sitemap: static Czech pages + products/collections/categories fetched via
     the existing Medusa data helpers in `src/lib/data/` (region-aware `/cz/...`
     URLs, `NEXT_PUBLIC_BASE_URL` as base).
2. Delete `src/app/opengraph-image.jpg` + `src/app/twitter-image.jpg` (Medusa
   starter „Next.js Starter Template" lamp — currently every social share shows
   it). Create `src/app/opengraph-image.tsx` with `ImageResponse`: brand paper
   `#eee8d6`, ink `#212222`, „Keramická zahrada" + „Ručně vyráběná keramika" —
   typographically calm, no stock imagery. Alt text Czech.
3. `src/lib/util/env.ts`: fix `getBaseURL` — `https://localhost:8000` is wrong
   twice over; default to `http://localhost:8000` in dev and log loudly when
   `NEXT_PUBLIC_BASE_URL` is unset in production (`metadataBase` feeds every
   OG/canonical URL).
4. `src/app/layout.tsx` metadata: add default `title` template
   („%s — Keramická zahrada"), `description`, `openGraph` + `twitter` blocks,
   `icons` if the favicon needs declaring (verify `public/favicon.ico` is the
   brand mark, not Medusa's — if it's the starter one, report it; do not draw one).
5. `generateMetadata` for `/store`, `/collections/[handle]`,
   `/categories/[...category]`, `/search`, `/results/[query]`: real titles/
   descriptions from the entity (collection/category name), canonical URLs
   via `alternates.canonical` (canonicalize to the `cz` locale).

## Gate (run at the end, fix what breaks)

```
cd storefront
npx tsc --noEmit
pnpm build   # runs the style sync; must succeed
```
If a concurrent model's build collides with yours, rerun. Finish with a report:
every `POTVRDIT` flag you left, anything you found that belongs to another
model's territory, and the list of legal points needing lawyer sign-off.
