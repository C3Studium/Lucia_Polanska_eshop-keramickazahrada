/**
 * Protokoly o nezávadnosti glazur — k e-mailu s potvrzením objednávky.
 *
 * Lucie nahrává protokoly ve Studiu (typ `certifikat`, druh „glazura" —
 * storefront `lib/valecms.types.ts`). Backend do databáze Studia nevidí, a tak
 * je čte ze storefrontu (`GET /api/certifikaty`), stejně jako je vypisuje
 * stránka /certifikaty. Dokud žádný protokol publikovaný není, nic se nepřiloží
 * a e-mail o protokolu mlčí — tvrdit „přikládáme protokol" bez protokolu by
 * bylo klamavé.
 *
 * Kterých výrobků se to týká, říká popis výrobku: tvrzení „zdravotně
 * nezávadné" / „pro styk s potravinami". ZRCADLÍ `safetySentencesFor`
 * ve storefrontu (`modules/products/components/safety-notice`) — když se
 * změní tam, musí se změnit i tady, jinak stránka výrobku a e-mail řeknou
 * o témže kusu něco jiného.
 */

const FOOD_CLAIM = /zdravotně\s+nezávadn|nezávadn[ýáéí]\w*\s+(materi|glaz)|pro\s+styk\s+s\s+potravin/i
const FOOD_CLAIM_NEGATED = /\bnen[íi]\b[^.]*(potravin|nezávadn)|nevhodn/i

/** Tvrdí popis výrobku, že je glazura zdravotně nezávadná? */
export const hasFoodClaim = (description: string | null | undefined): boolean => {
  const text = description ?? ""
  return FOOD_CLAIM.test(text) && !FOOD_CLAIM_NEGATED.test(text)
}

export type GlazeProtocol = {
  /** Glazura, jak ji Lucie pojmenovala ve Studiu. */
  glaze: string
  laboratory: string
  issuedAt: string
  number?: string
  /** Veřejná https adresa PDF. */
  url: string
}

const TIMEOUT_MS = 3_000
const CACHE_MS = 5 * 60_000
let cache: { at: number; base: string; protocols: GlazeProtocol[] } | null = null

/** Kořen storefrontu bez země (`https://…`), nebo "" když není nastavený. */
const storefrontRoot = (): string =>
  (process.env.STOREFRONT_PUBLIC_URL || process.env.MEDUSA_STOREFRONT_URL || "").replace(/\/+$/, "")

/**
 * Publikované protokoly glazur. Nikdy nevyhodí — výpadek storefrontu nesmí
 * zdržet potvrzení objednávky; vrátí prázdný seznam a e-mail jde bez nich.
 */
export const fetchGlazeProtocols = async (
  fetchImpl: typeof fetch = fetch
): Promise<GlazeProtocol[]> => {
  const base = storefrontRoot()
  if (!base) return []
  // Prázdný seznam se pamatuje jen minutu — čerstvě publikovaný protokol se
  // tak do potvrzení dostane hned, ne až za pět minut.
  const ttl = cache?.protocols.length ? CACHE_MS : 60_000
  if (cache && cache.base === base && Date.now() - cache.at < ttl) return cache.protocols

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetchImpl(`${base}/api/certifikaty`, { signal: controller.signal })
    if (!response.ok) return []
    const body = (await response.json()) as { glazes?: unknown }
    const protocols = (Array.isArray(body?.glazes) ? body.glazes : [])
      .map((row: any) => ({
        glaze: String(row?.glaze ?? "").trim(),
        laboratory: String(row?.laboratory ?? "").trim(),
        issuedAt: String(row?.issuedAt ?? ""),
        number: row?.number ? String(row.number) : undefined,
        url: String(row?.url ?? ""),
      }))
      // Odkaz stačí http(s); přílohou jde jen https (víc Resend nevezme).
      .filter((row) => row.glaze && /^https?:\/\//i.test(row.url))
    cache = { at: Date.now(), base, protocols }
    return protocols
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/** Jen pro testy. */
export const resetGlazeProtocolCache = () => {
  cache = null
}

const fileName = (protocol: GlazeProtocol, index: number): string => {
  const slug = protocol.glaze
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const ext = /\.(png|jpe?g|webp)(\?|$)/i.test(protocol.url) ? protocol.url.match(/\.(png|jpe?g|webp)/i)![0] : ".pdf"
  return `Protokol-glazura-${slug || index + 1}${ext.toLowerCase()}`
}

export type OrderGlazeProtocols = {
  /** Řádky objednávky (id), u kterých popis výrobku tvrdí nezávadnost. */
  item_ids: string[]
  documents: { glaze: string; laboratory: string; issued_at: string; number: string | null; url: string }[]
  attachments: { filename: string; url: string }[]
}

/**
 * Co k objednávce patří: výrobky s tvrzením o nezávadnosti a protokoly.
 * Bez takového výrobku nebo bez publikovaného protokolu prázdné.
 */
export const glazeProtocolsForOrder = (
  order: any,
  protocols: GlazeProtocol[]
): OrderGlazeProtocols => {
  const itemIds = ((order?.items ?? []) as any[])
    .filter((item) => hasFoodClaim(item?.product?.description))
    .map((item) => String(item.id))
  if (!itemIds.length || !protocols.length) {
    return { item_ids: itemIds.length && protocols.length ? itemIds : [], documents: [], attachments: [] }
  }
  return {
    item_ids: itemIds,
    documents: protocols.map((protocol) => ({
      glaze: protocol.glaze,
      laboratory: protocol.laboratory,
      issued_at: protocol.issuedAt,
      number: protocol.number ?? null,
      url: protocol.url,
    })),
    attachments: protocols
      .filter((protocol) => /^https:\/\//i.test(protocol.url))
      .map((protocol, index) => ({ filename: fileName(protocol, index), url: protocol.url })),
  }
}
