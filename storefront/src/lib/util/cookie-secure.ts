/**
 * Má mít cookie příznak `secure`?
 *
 * V produkci ano — ale jen když obchod běží na https. Produkční build pro
 * test na iPhonu běží na `http://192.168.1.31:4700` a Safari cookie se
 * `secure` přes http zahodí: košík byl po každém načtení prázdný a do košíku
 * „nešlo nic dát" (13. 11. 2026). Bez známé adresy obchodu se drží
 * bezpečnější varianta.
 */
export const cookieSecure = (
  nodeEnv: string | undefined,
  baseUrl: string | undefined
): boolean => {
  if (nodeEnv !== "production") return false
  if (!baseUrl) return true
  return !baseUrl.trim().toLowerCase().startsWith("http:")
}
