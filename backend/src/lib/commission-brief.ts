/**
 * Zadání zakázky v metadatech řádku — jeden tvar pro košík, administraci
 * i Potvrzení zakázky.
 *
 * ## Kus, ne řádek
 *
 * „Domovní znamení · 2 ks" je jeden řádek košíku, ale dva kusy, a každý může
 * mít jiné jméno, jiné rozměry, jinou fotku (30. 10. 2026). Zadání proto
 * bydlí v poli `made_to_order.pieces[]`, jedno na kus.
 *
 * ## Proč `specification` a `photos` zůstávají
 *
 * Čte je všechno ostatní: projekce zakázek v administraci, PDF Potvrzení
 * zakázky, e-maily, mini obchod úpravy objednávky. Kdyby se pole prostě
 * přidalo vedle, všechna ta místa by po rozdělení na kusy ukazovala jen
 * zadání prvního z nich. Drží se proto jako SLOŽENÝ pohled přes všechny
 * kusy — „Kus 1: …" / „Kus 2: …", fotky za sebou — a nikdo z nich o kusech
 * vědět nemusí.
 *
 * Řádek s jediným kusem pole vůbec nezakládá a vypadá přesně jako dřív.
 */

export type CommissionPiece = {
  specification?: string
  photos?: string[]
}

export type CommissionBriefMetadata = {
  made_to_order: {
    specification: string
    photos?: string[]
    pieces?: CommissionPiece[]
    note?: string
    ack_at?: string
  }
}

const asString = (value: unknown): string =>
  typeof value === "string" ? value : ""

const asPhotos = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((url): url is string => typeof url === "string" && !!url)
    : []

/** Kusy, jak leží v metadatech — doplněné na `quantity` a bez děr. */
export const readCommissionPieces = (
  metadata: Record<string, unknown> | null | undefined,
  quantity: number
): CommissionPiece[] => {
  const mto = (metadata?.made_to_order ?? null) as Record<string, unknown> | null
  const count = Math.max(1, Math.floor(quantity) || 1)
  const stored = Array.isArray(mto?.pieces) ? (mto!.pieces as unknown[]) : null

  const pieces: CommissionPiece[] = Array.from({ length: count }, (_, index) => {
    const raw = (stored?.[index] ?? null) as Record<string, unknown> | null
    if (raw) {
      return {
        specification: asString(raw.specification),
        photos: asPhotos(raw.photos),
      }
    }
    /*
     * Bez pole (nebo za jeho koncem): zadání z doby před kusy patří PRVNÍMU
     * kusu. Zbylé kusy začínají prázdné — ne jako kopie prvního, protože
     * „vyplněno" by pak lhalo a brána by pustila kus bez zadání.
     */
    if (index === 0 && !stored) {
      return {
        specification: asString(mto?.specification) || asString(mto?.note),
        photos: asPhotos(mto?.photos),
      }
    }
    return { specification: "", photos: [] }
  })

  return pieces
}

/** Má kus zadání? Text NEBO fotka — táž podmínka jako brána v pokladně. */
export const pieceHasContent = (piece: CommissionPiece): boolean =>
  Boolean(piece.specification?.trim() || (piece.photos?.length ?? 0))

/**
 * Složený pohled přes kusy do `specification`: u jediného kusu holý text,
 * u víc kusů očíslovaný, a prázdné kusy se vynechávají.
 */
export const composeSpecification = (pieces: CommissionPiece[]): string => {
  const filled = pieces
    .map((piece, index) => ({ index, text: piece.specification?.trim() ?? "" }))
    .filter((entry) => entry.text)
  if (!filled.length) return ""
  if (pieces.length === 1) return filled[0].text
  return filled.map((entry) => `Kus ${entry.index + 1}: ${entry.text}`).join("\n\n")
}

/** Všechny fotky přes kusy, bez duplicit a v pořadí kusů. */
export const composePhotos = (pieces: CommissionPiece[]): string[] => [
  ...new Set(pieces.flatMap((piece) => piece.photos ?? [])),
]

/**
 * Zapíše zadání JEDNOHO kusu a vrátí celá metadata `made_to_order` k uložení.
 *
 * `ack_at` (poučení Z10) se nese dál: ukládání briefu po kliknutí na platbu
 * by jinak čas zaškrtnutí smazalo — Medusa metadata slučuje po klíčích, ale
 * `made_to_order` je JEDEN objekt a nahrazuje se celý.
 */
export const mergeCommissionBrief = (input: {
  current: Record<string, unknown> | null | undefined
  quantity: number
  piece?: number | null
  /** Vynechané = zadání se nemění (zápis samotného `ack_at`). */
  note?: string | null
  photos?: string[] | null
  /** Čas zaškrtnutí poučení Z10; vynechaný = nechat, co tam je. */
  ackAt?: string | null
}): CommissionBriefMetadata => {
  const count = Math.max(1, Math.floor(input.quantity) || 1)
  const pieces = readCommissionPieces(input.current, count)
  const index = Math.min(Math.max(0, Math.floor(input.piece ?? 0)), count - 1)

  /*
   * Zápis samotného poučení (pokladna zaškrtne Z10) nesmí přepsat zadání —
   * dřív se celý objekt skládal znovu z `specification` a `photos`, což by
   * s kusy znamenalo, že zaškrtnutí smaže zadání všech kusů kromě složeného
   * textu prvního.
   */
  if (input.note !== undefined && input.note !== null) {
    pieces[index] = {
      specification: input.note.trim(),
      photos: [...new Set((input.photos ?? []).filter(Boolean))],
    }
  }

  const mto = (input.current?.made_to_order ?? null) as Record<string, unknown> | null
  const ackAt = asString(input.ackAt ?? mto?.ack_at)
  /* Rozlišovací značka kusu (`custom-add-to-cart`) — bez ní by se dva
     jinak shodné zakázkové řádky mohly zase slít v jeden. */
  const pieceKey = asString(mto?.piece_key)

  return {
    made_to_order: {
      specification: composeSpecification(pieces),
      ...(composePhotos(pieces).length ? { photos: composePhotos(pieces) } : {}),
      // Pole jen tam, kde má smysl — jeden kus vypadá přesně jako dřív.
      ...(count > 1 ? { pieces } : {}),
      ...(ackAt ? { ack_at: ackAt } : {}),
      ...(pieceKey ? { piece_key: pieceKey } : {}),
    },
  }
}
