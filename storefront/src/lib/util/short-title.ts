/**
 * Název výrobku zkrácený na pár slov — pro košík, pokladnu a přehled
 * (13. 11. 2026). Celý název tam rozbíjel sloupce cen; plný zní dál na
 * detailu výrobku a v atributu `title`.
 *
 * Oddělovače („-", „–", „,") se počítají jako slovo, ale na konci zkráceného
 * názvu nezůstávají; stejně tak osamělá spojka nebo předložka („s", „a").
 */
const ODDELOVAC = /^[-–—,;:/|·]+$/
const SPOJKA = /^(a|i|s|se|v|ve|z|ze|k|ke|o|u|na|do|pro|po|od)$/i

export const shortTitle = (title: string | null | undefined, words = 3): string => {
  const tokens = (title ?? "").split(/\s+/).filter(Boolean)
  if (tokens.length <= words) return tokens.join(" ")

  const kept = tokens.slice(0, words)
  while (kept.length && (ODDELOVAC.test(kept[kept.length - 1]) || SPOJKA.test(kept[kept.length - 1]))) {
    kept.pop()
  }
  if (!kept.length) return tokens.join(" ")
  kept[kept.length - 1] = kept[kept.length - 1].replace(/[-–—,;:/|·]+$/, "")
  return kept.join(" ") + "…"
}
