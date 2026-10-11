import "server-only"

/**
 * Typ vybrané výdejny Balíkovny pro pokladnu (box → bez dobírky).
 *
 * Nový výběr nese typ v `cart.metadata.balikovna_point_subtype` (ukládá krok
 * dopravy z pickerResult). Košík s výdejnou vybranou dřív ho nemá — pak se
 * dohledá ve veřejném API widgetu ČP podle id bodu (`B` + PSČ). Odpověď se
 * drží den v cache; typ místa se prakticky nemění.
 *
 * Neznámý typ (API nedostupné) vrací `null` — pokladna pak dobírku nechá a
 * rozhodne backend při dokončení (stejné pravidlo, `lib/balikovna-point.ts`).
 */
export async function resolveBalikovnaSubtype(
  metadata: Record<string, unknown> | null | undefined
): Promise<string | null> {
  const stored = metadata?.balikovna_point_subtype
  if (typeof stored === "string" && stored.trim()) {
    return stored.trim().toUpperCase()
  }

  const rawId =
    typeof metadata?.balikovna_point_id === "string"
      ? metadata.balikovna_point_id.trim()
      : ""
  const zip =
    typeof metadata?.balikovna_point_zip === "string"
      ? metadata.balikovna_point_zip.replace(/\s+/g, "")
      : ""
  const pointId = /^B\d+$/i.test(rawId)
    ? rawId.toUpperCase()
    : /^\d{5}$/.test(zip)
      ? `B${zip}`
      : null
  if (!pointId) {
    return null
  }

  try {
    const response = await fetch(
      `https://b2c.cpost.cz/locations/api/points/${encodeURIComponent(pointId)}`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) }
    )
    if (!response.ok) {
      return null
    }
    const body = (await response.json()) as { subtype?: unknown } | null
    return typeof body?.subtype === "string" && body.subtype.trim()
      ? body.subtype.trim().toUpperCase()
      : null
  } catch {
    return null
  }
}
