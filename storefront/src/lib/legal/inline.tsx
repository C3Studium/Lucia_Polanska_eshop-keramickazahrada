import type { ReactNode } from "react"
import { fact, isFactKey, missingFactLabel } from "./facts"

/**
 * Vnořená značka v právních textech → React (web, tisk do PDF) nebo prostý
 * text (e-maily, testy). Gramatika je popsaná v `./types.ts`.
 *
 * Bez hooků a bez klientských komponent — funguje v serverové komponentě,
 * v klientské i v tiskové stránce pro PDF.
 */

export type InlineOptions = {
  /**
   * Převod interní cesty (`/smluvni-podminky#x`) na href. Výchozí přidá
   * prefix země `/cz`; tisk do PDF dává absolutní URL na ostrou doménu.
   */
  hrefFor?: (path: string) => string
  /** CSS třída pro zvýrazněný zástupný text `[[DOPLNIT: …]]`. */
  placeholderClassName?: string
}

export type Token =
  | { kind: "text"; value: string }
  /**
   * `value` = syrový vnitřek; `children` = jeho rozklad — fakt, zástupný
   * text i odkaz uvnitř tučného písma se tak vykreslí stejně jako mimo něj
   * (`**{{seller.name}}**`).
   */
  | { kind: "bold"; value: string; children: Token[] }
  | { kind: "link"; label: string; href: string }
  | { kind: "placeholder"; value: string }

const TOKEN =
  /\[\[DOPLNIT:\s*([^\]]+?)\s*\]\]|\{\{([a-zA-Z0-9.]+)\}\}|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g

/** Rozloží řetězec na tokeny. Fakty `{{…}}` se rovnou dosadí. */
export const tokenize = (input: string): Token[] => {
  const tokens: Token[] = []
  let last = 0
  // `exec` ve smyčce, ne `matchAll`: tsconfig storefrontu má target es5.
  const pattern = new RegExp(TOKEN.source, "g")
  let match: RegExpExecArray | null
  while ((match = pattern.exec(input)) !== null) {
    const index = match.index
    if (index > last) tokens.push({ kind: "text", value: input.slice(last, index) })
    const [, placeholder, factKey, bold, linkLabel, linkHref] = match
    if (placeholder !== undefined) {
      tokens.push({ kind: "placeholder", value: placeholder })
    } else if (factKey !== undefined) {
      if (!isFactKey(factKey)) {
        tokens.push({ kind: "placeholder", value: `neznámý údaj ${factKey}` })
      } else {
        const value = fact(factKey)
        tokens.push(
          value === null
            ? { kind: "placeholder", value: missingFactLabel(factKey) }
            : { kind: "text", value }
        )
      }
    } else if (bold !== undefined) {
      tokens.push({ kind: "bold", value: bold, children: tokenize(bold) })
    } else if (linkLabel !== undefined && linkHref !== undefined) {
      tokens.push({ kind: "link", label: linkLabel, href: linkHref })
    }
    last = index + match[0].length
  }
  if (last < input.length) tokens.push({ kind: "text", value: input.slice(last) })
  return tokens
}

const defaultHrefFor = (path: string) => `/cz${path}`

const resolveHref = (href: string, hrefFor: (path: string) => string) =>
  href.startsWith("/") ? hrefFor(href) : href

/** Všechny tokeny včetně vnořených v tučném písmu (pro počítání, kontroly). */
export const flattenTokens = (tokens: Token[]): Token[] =>
  tokens.flatMap((token) =>
    token.kind === "bold" ? [token, ...flattenTokens(token.children)] : [token]
  )

/** Řetězec se značkou → React uzly. */
export const renderInline = (input: string, options: InlineOptions = {}): ReactNode[] =>
  renderTokens(tokenize(input), options)

const renderTokens = (tokens: Token[], options: InlineOptions): ReactNode[] => {
  const hrefFor = options.hrefFor ?? defaultHrefFor
  return tokens.map((token, index) => {
    switch (token.kind) {
      case "text":
        return token.value
      case "bold":
        return <strong key={index}>{renderTokens(token.children, options)}</strong>
      case "link": {
        const href = resolveHref(token.href, hrefFor)
        const external = /^https?:\/\//.test(href)
        return (
          <a
            key={index}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {token.label}
          </a>
        )
      }
      case "placeholder":
        return (
          <mark
            key={index}
            className={options.placeholderClassName}
            data-legal-placeholder=""
          >
            [[DOPLNIT: {token.value}]]
          </mark>
        )
    }
  })
}

/** Řetězec se značkou → prostý text (odkaz jako „text (href)"). */
export const inlineToPlain = (input: string, options: InlineOptions = {}): string =>
  tokensToPlain(tokenize(input), options.hrefFor ?? defaultHrefFor)

const tokensToPlain = (tokens: Token[], hrefFor: (path: string) => string): string =>
  tokens
    .map((token) => {
      switch (token.kind) {
        case "text":
          return token.value
        case "bold":
          return tokensToPlain(token.children, hrefFor)
        case "link":
          return `${token.label} (${resolveHref(token.href, hrefFor)})`
        case "placeholder":
          return `[[DOPLNIT: ${token.value}]]`
      }
    })
    .join("")

/** Obsahuje text zástupný údaj (přímo, přes chybějící fakt, i v tučném písmu)? */
export const hasPlaceholder = (input: string): boolean =>
  flattenTokens(tokenize(input)).some((token) => token.kind === "placeholder")
