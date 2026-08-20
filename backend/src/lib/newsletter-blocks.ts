import { z } from "@medusajs/framework/zod"

/**
 * The newsletter's content model: an ordered list of blocks.
 *
 * The admin's „Napsat" tab builds these, `POST /admin/newsletter/preview`
 * renders them, the campaign send stores them, and the `promotional` e-mail
 * template turns them into brand HTML. One schema, so all four agree.
 *
 * ## Why a `handle`, not a URL, on the product block
 *
 * The admin snapshots what the e-mail shows (title, photo, price) at pick
 * time — a price in a sent e-mail must be the price she saw when she wrote
 * it. But the *link* is composed at render time from the product handle via
 * `lib/storefront-url.ts`, the one module that knows where the storefront
 * lives. An absolute URL stored in the block would silently go stale on a
 * domain move; a handle cannot.
 *
 * ## Paragraph runs (bold + inline links)
 *
 * A paragraph is a list of *runs* — `{ text, bold?, url? }` — never free
 * HTML. The editor's toolbar serialises to exactly this model and the
 * renderer maps it back to `<strong>`/`<a>`, with React escaping everything
 * in between, so no other markup can survive the round trip. A paragraph
 * stored before runs existed carries a plain `text` string; every consumer
 * keeps accepting that and treats it as one plain run.
 *
 * ## Two sanitisers
 *
 * - `sanitizeBlocks` — strict. What comes out is *sendable*: unfinished or
 *   malformed blocks are dropped. Used by preview, test and campaign send.
 * - `sanitizeDraftBlocks` — lenient. A draft is work in progress, and a
 *   half-typed button must survive the round trip to the server and back.
 *   Only the dangerous parts are enforced (type whitelist, length caps,
 *   URL schemes, the runs-only paragraph model); nothing is dropped for
 *   being incomplete.
 *
 * Pure: no framework imports beyond zod, unit-tested in
 * `__tests__/newsletter-blocks.unit.spec.ts`.
 */

const text = (max: number) => z.string().max(max)

/** The one URL rule of this file: an e-mail may only ever point at the web. */
export const isWebUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim())

/** More tiles than this stops being a teaser and starts being the shop. */
export const MAX_CATALOG_PRODUCTS = 6

export type HeadingLevel = 1 | 2 | 3

/** Missing/legacy/garbage levels all land on 2 — the pre-levels rendering. */
export const normalizeHeadingLevel = (level: unknown): HeadingLevel =>
  level === 1 || level === 2 || level === 3 ? level : 2

/** One formatted stretch of paragraph text. */
export const NewsletterRunSchema = z.object({
  text: z.string().max(4000),
  bold: z.boolean().optional(),
  url: z.string().max(1000).optional(),
})

export type NewsletterRun = z.infer<typeof NewsletterRunSchema>

/** More runs than this is not a paragraph anymore. */
export const MAX_PARAGRAPH_RUNS = 50

export const NewsletterBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    text: text(200),
    /** 1 velký titulek · 2 mezititulek (default) · 3 drobný nadpis. */
    level: z.number().optional(),
  }),
  z.object({
    type: z.literal("paragraph"),
    /** Legacy plain text — still accepted, becomes one plain run. */
    text: text(8000).optional(),
    runs: z.array(NewsletterRunSchema).max(200).optional(),
  }),
  z.object({
    type: z.literal("button"),
    label: text(120),
    url: z.string().url().max(1000),
  }),
  z.object({
    type: z.literal("product"),
    product_id: z.string().min(1),
    title: text(300),
    handle: z.string().min(1).max(300),
    thumbnail: z.string().max(2000).nullable().optional(),
    price_text: text(100).nullable().optional(),
  }),
  z.object({
    type: z.literal("image"),
    /** Absolute URL from the shop's own photo storage (`/admin/uploads`). */
    src: z.string().max(2000),
    /** What the photo shows — read aloud and shown when it fails to load. */
    alt: text(300).optional(),
    /** Optional click-through target. */
    link: z.string().max(1000).nullable().optional(),
  }),
  z.object({
    /** A grid of product tiles — the „catalogue" section of a campaign. */
    type: z.literal("catalog"),
    products: z
      .array(
        z.object({
          product_id: z.string().min(1),
          title: text(300),
          handle: z.string().min(1).max(300),
          thumbnail: z.string().max(2000).nullable().optional(),
          price_text: text(100).nullable().optional(),
        })
      )
      /* Safety bound only — the sanitiser trims to MAX_CATALOG_PRODUCTS.
         Rejecting at 7 would silently drop the whole block; trimming keeps
         the first six, which is what the sender meant. */
      .max(24),
  }),
  z.object({
    /** Akce/sleva — a framed announcement, optionally with a promo code. */
    type: z.literal("promo"),
    title: text(200),
    code: text(40).nullable().optional(),
    /** Terms in one line — „Platí do konce října na všechny hrnky." */
    note: text(300).nullable().optional(),
    label: text(120).nullable().optional(),
    url: z.string().max(1000).nullable().optional(),
  }),
  z.object({
    type: z.literal("divider"),
  }),
])

export type NewsletterBlock = z.infer<typeof NewsletterBlockSchema>

/** More blocks than this is not an e-mail anymore. */
export const MAX_BLOCKS = 40

/**
 * Runs → the clean run list, or `null` when nothing readable remains.
 *
 * - drops runs whose text is empty, and edge whitespace (the paragraph-level
 *   `trim()` of the plain-text era, applied across run boundaries),
 * - strips URLs that do not point at the web — the text stays, the link goes,
 * - keeps `bold` only when it is literally `true`,
 * - merges neighbours with identical formatting (toolbar toggling leaves
 *   fragmented but identical runs behind),
 * - caps the list at MAX_PARAGRAPH_RUNS.
 */
const cleanRuns = (input: NewsletterRun[]): NewsletterRun[] | null => {
  const runs: NewsletterRun[] = []

  for (const raw of input.slice(0, MAX_PARAGRAPH_RUNS)) {
    if (!raw.text.length) {
      continue
    }
    const url = typeof raw.url === "string" ? raw.url.trim() : ""
    const run: NewsletterRun = {
      text: raw.text,
      ...(raw.bold === true ? { bold: true } : {}),
      ...(isWebUrl(url) ? { url } : {}),
    }

    const previous = runs[runs.length - 1]
    if (
      previous &&
      Boolean(previous.bold) === Boolean(run.bold) &&
      (previous.url ?? "") === (run.url ?? "")
    ) {
      previous.text += run.text
    } else {
      runs.push(run)
    }
  }

  // Leading whitespace off the front…
  while (runs.length) {
    runs[0].text = runs[0].text.replace(/^\s+/, "")
    if (runs[0].text) break
    runs.shift()
  }
  // …and trailing off the back.
  while (runs.length) {
    const last = runs[runs.length - 1]
    last.text = last.text.replace(/\s+$/, "")
    if (last.text) break
    runs.pop()
  }

  return runs.length ? runs : null
}

/**
 * Turns whatever the wire delivered into a clean, renderable block list.
 *
 * - drops anything that is not a valid block (rather than failing the whole
 *   campaign over one malformed leftover),
 * - trims text and drops blocks that trimmed to nothing — an empty heading
 *   would render as a blank serif line,
 * - drops dividers at the edges and doubled dividers — two hairlines in a row
 *   read as a rendering bug,
 * - caps the list at MAX_BLOCKS.
 */
export const sanitizeBlocks = (input: unknown): NewsletterBlock[] => {
  if (!Array.isArray(input)) {
    return []
  }

  const cleaned: NewsletterBlock[] = []

  for (const raw of input.slice(0, MAX_BLOCKS)) {
    const parsed = NewsletterBlockSchema.safeParse(raw)
    if (!parsed.success) {
      continue
    }
    const block = parsed.data

    switch (block.type) {
      case "heading": {
        const trimmed = block.text.trim()
        if (!trimmed) {
          continue
        }
        cleaned.push({
          type: "heading",
          text: trimmed,
          level: normalizeHeadingLevel(block.level),
        })
        break
      }
      case "paragraph": {
        const runs = cleanRuns(
          block.runs ?? (typeof block.text === "string" ? [{ text: block.text }] : [])
        )
        if (!runs) {
          continue
        }
        cleaned.push({
          type: "paragraph",
          // The joined plain text rides along so every reader of the
          // pre-runs shape (`block.text`) keeps working unchanged.
          text: runs.map((run) => run.text).join(""),
          runs,
        })
        break
      }
      case "button": {
        const label = block.label.trim()
        const url = block.url.trim()
        // zod's `.url()` accepts any scheme (`javascript:` included). An
        // e-mail button may only ever point at the web.
        if (!label || !isWebUrl(url)) {
          continue
        }
        cleaned.push({ ...block, label, url })
        break
      }
      case "product": {
        const title = block.title.trim()
        const handle = block.handle.trim()
        if (!title || !handle) {
          continue
        }
        // Same rule as the button URL: an image in an e-mail may only ever
        // point at the web — anything else (`javascript:`, `data:`, a stray
        // relative path) is dropped rather than rendered.
        const thumbnail = block.thumbnail?.trim() || null
        cleaned.push({
          ...block,
          title,
          handle,
          thumbnail: thumbnail && isWebUrl(thumbnail) ? thumbnail : null,
          price_text: block.price_text?.trim() || null,
        })
        break
      }
      case "image": {
        const src = block.src.trim()
        // No web URL, no image — a broken or scheme-smuggled photo is worse
        // than none.
        if (!isWebUrl(src)) {
          continue
        }
        const link = block.link?.trim() || null
        cleaned.push({
          type: "image",
          src,
          alt: block.alt?.trim() ?? "",
          link: link && isWebUrl(link) ? link : null,
        })
        break
      }
      case "catalog": {
        // Each tile follows the single-product rules; a grid with nothing
        // presentable left is dropped whole.
        const products = block.products
          .map((product) => {
            const title = product.title.trim()
            const handle = product.handle.trim()
            if (!title || !handle) {
              return null
            }
            const thumbnail = product.thumbnail?.trim() || null
            return {
              product_id: product.product_id,
              title,
              handle,
              thumbnail: thumbnail && isWebUrl(thumbnail) ? thumbnail : null,
              price_text: product.price_text?.trim() || null,
            }
          })
          .filter(
            (product): product is NonNullable<typeof product> =>
              product !== null
          )
          .slice(0, MAX_CATALOG_PRODUCTS)
        if (!products.length) {
          continue
        }
        cleaned.push({ type: "catalog", products })
        break
      }
      case "promo": {
        const title = block.title.trim()
        if (!title) {
          continue
        }
        const url = block.url?.trim() || null
        cleaned.push({
          type: "promo",
          title,
          code: block.code?.trim() || null,
          note: block.note?.trim() || null,
          label: block.label?.trim() || null,
          url: url && isWebUrl(url) ? url : null,
        })
        break
      }
      case "divider": {
        // No divider first, and never two in a row.
        if (!cleaned.length || cleaned[cleaned.length - 1].type === "divider") {
          continue
        }
        cleaned.push(block)
        break
      }
    }
  }

  // No divider last, either.
  while (cleaned.length && cleaned[cleaned.length - 1].type === "divider") {
    cleaned.pop()
  }

  return cleaned
}

/* ------------------------------------------------------------------ */
/* Drafts — the lenient twin                                           */
/* ------------------------------------------------------------------ */

export type DraftRun = { text: string; bold?: boolean; url?: string }

export type DraftBlock =
  | { type: "heading"; text: string; level: HeadingLevel }
  | { type: "paragraph"; runs: DraftRun[] }
  | { type: "button"; label: string; url: string }
  | {
      type: "product"
      product_id?: string
      title?: string
      handle?: string
      thumbnail?: string | null
      price_text?: string | null
    }
  | { type: "image"; src: string; alt: string; link: string }
  | {
      type: "catalog"
      products: {
        product_id: string
        title: string
        handle: string
        thumbnail: string | null
        price_text: string | null
      }[]
    }
  | {
      type: "promo"
      title: string
      code: string
      note: string
      label: string
      url: string
    }
  | { type: "divider" }

const str = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : ""

/** Web URL kept as-is, anything else (javascript:, data:, half-typed) → "". */
const webUrlOrEmpty = (value: unknown, max: number): string => {
  const candidate = str(value, max).trim()
  return isWebUrl(candidate) ? candidate : ""
}

/**
 * A draft keeps *everything the editor holds*, incomplete blocks included —
 * autosave must never eat a half-typed button. What it still enforces is
 * safety, not completeness: known types only, string coercion with length
 * caps, http(s)-or-nothing on every URL field, the runs-only paragraph
 * model, MAX_BLOCKS.
 */
export const sanitizeDraftBlocks = (input: unknown): DraftBlock[] => {
  if (!Array.isArray(input)) {
    return []
  }

  const cleaned: DraftBlock[] = []

  for (const raw of input.slice(0, MAX_BLOCKS)) {
    if (!raw || typeof raw !== "object") {
      continue
    }
    const block = raw as Record<string, unknown>

    switch (block.type) {
      case "heading":
        cleaned.push({
          type: "heading",
          text: str(block.text, 200),
          level: normalizeHeadingLevel(block.level),
        })
        break
      case "paragraph": {
        const rawRuns = Array.isArray(block.runs)
          ? block.runs
          : typeof block.text === "string"
            ? [{ text: block.text }]
            : []
        const runs: DraftRun[] = []
        for (const entry of rawRuns.slice(0, MAX_PARAGRAPH_RUNS)) {
          if (!entry || typeof entry !== "object") {
            continue
          }
          const run = entry as Record<string, unknown>
          const runText = str(run.text, 4000)
          if (!runText) {
            continue
          }
          const url = webUrlOrEmpty(run.url, 1000)
          runs.push({
            text: runText,
            ...(run.bold === true ? { bold: true } : {}),
            ...(url ? { url } : {}),
          })
        }
        cleaned.push({ type: "paragraph", runs })
        break
      }
      case "button":
        cleaned.push({
          type: "button",
          label: str(block.label, 120),
          url: webUrlOrEmpty(block.url, 1000),
        })
        break
      case "product":
        if (typeof block.product_id === "string" && block.product_id) {
          const thumbnail = webUrlOrEmpty(block.thumbnail, 2000)
          cleaned.push({
            type: "product",
            product_id: block.product_id,
            title: str(block.title, 300),
            handle: str(block.handle, 300),
            thumbnail: thumbnail || null,
            price_text: str(block.price_text, 100) || null,
          })
        } else {
          // Placeholder — the block exists, the product is not picked yet.
          cleaned.push({ type: "product" })
        }
        break
      case "image":
        cleaned.push({
          type: "image",
          src: webUrlOrEmpty(block.src, 2000),
          alt: str(block.alt, 300),
          link: webUrlOrEmpty(block.link, 1000),
        })
        break
      case "catalog": {
        const rawProducts = Array.isArray(block.products) ? block.products : []
        cleaned.push({
          type: "catalog",
          products: rawProducts
            .slice(0, MAX_CATALOG_PRODUCTS)
            .flatMap((raw) => {
              const product = raw as Record<string, unknown> | null
              return product &&
                typeof product === "object" &&
                typeof product.product_id === "string" &&
                product.product_id
                ? [
                    {
                      product_id: product.product_id,
                      title: str(product.title, 300),
                      handle: str(product.handle, 300),
                      thumbnail: webUrlOrEmpty(product.thumbnail, 2000) || null,
                      price_text: str(product.price_text, 100) || null,
                    },
                  ]
                : []
            }),
        })
        break
      }
      case "promo":
        cleaned.push({
          type: "promo",
          title: str(block.title, 200),
          code: str(block.code, 40),
          note: str(block.note, 300),
          label: str(block.label, 120),
          url: webUrlOrEmpty(block.url, 1000),
        })
        break
      case "divider":
        cleaned.push({ type: "divider" })
        break
      default:
        break
    }
  }

  return cleaned
}

/* ------------------------------------------------------------------ */

export type CampaignContent = {
  subject?: string | null
  preheader?: string | null
  blocks: NewsletterBlock[]
}

/**
 * The Czech reasons a composition cannot be sent yet. Empty array = sendable.
 * Shared verbatim between the admin's disabled-button hint and the server's
 * refusal, so she never sees a button reject silently.
 */
export const campaignContentProblems = (content: CampaignContent): string[] => {
  const problems: string[] = []

  if (!(content.subject ?? "").trim()) {
    problems.push("Chybí předmět e-mailu.")
  }

  const hasSubstance = content.blocks.some(
    (block) => block.type !== "divider"
  )
  if (!hasSubstance) {
    problems.push("E-mail nemá žádný obsah — přidejte alespoň jeden blok.")
  }

  if (
    content.blocks.some(
      (block) => block.type === "image" && !(block.alt ?? "").trim()
    )
  ) {
    problems.push(
      "U obrázku zbývá doplnit popis — přečte ho hlasová čtečka a zobrazí se, když se obrázek nenačte."
    )
  }

  return problems
}
