/**
 * Komu jde „Zapomněli jste heslo?" (14. 11. 2026).
 *
 * 13. 11. dostával host (nakupoval bez účtu) při obnově hesla přihlášení
 * automaticky. Matěj 14. 11.: obnova hesla je jen pro účty; host si má účet
 * ZALOŽIT a jeho dřívější objednávky se k účtu připojí, až potvrdí e-mail
 * (lib/pripojit-objednavky-hosta.ts). Tady se proto už nic nezakládá — jen se
 * zjistí, co adresa u obchodu má, aby formulář mohl odpovědět pravdivě.
 *
 * - `ucet`  — má přihlášení (emailpass) → pošle se odkaz na nové heslo
 * - `host`  — nakupoval bez účtu → nabídnout založení účtu
 * - `nikdo` — adresu neznáme
 */
export type StavAdresy = "ucet" | "host" | "nikdo"

type Sluzby = {
  auth: {
    listProviderIdentities: (filter: Record<string, unknown>) => Promise<unknown[]>
  }
  customers: {
    listCustomers: (filter: Record<string, unknown>) => Promise<Array<{ id: string; has_account?: boolean | null }>>
  }
}

export const stavAdresy = async (email: string, { auth, customers }: Sluzby): Promise<StavAdresy> => {
  const adresa = email.trim().toLowerCase()
  const prihlaseni = await auth.listProviderIdentities({ provider: "emailpass", entity_id: adresa })
  if (prihlaseni.length) return "ucet"
  const zaznamy = await customers.listCustomers({ email: adresa })
  return zaznamy.length ? "host" : "nikdo"
}
