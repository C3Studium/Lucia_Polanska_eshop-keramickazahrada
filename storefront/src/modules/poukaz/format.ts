/** Kam se ozvat — poukazy vyřizuje Lucie sama, e-mailem. */
export const CONTACT_EMAIL = "info@keramickazahrada.cz"

/** Částka v korunách („1 500 Kč") — poukazy jsou vždy v celých korunách. */
export const czk = (value: number): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0))
