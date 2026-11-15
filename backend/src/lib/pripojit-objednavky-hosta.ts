/**
 * Objednávky z nákupů bez účtu se připojí k nově založenému účtu
 * (14. 11. 2026, Matěj).
 *
 * Kdo nakupoval bez účtu a pak si účet založí se stejným e-mailem, má v Meduse
 * dva záznamy zákazníka: hosta (`has_account: false`) s objednávkami a nový
 * účet bez nich. Po POTVRZENÍ e-mailu (odkaz z ověřovacího e-mailu dokazuje,
 * že schránka je jeho) se objednávky hosta převedou na účet. Dřív ne — jinak
 * by si kdokoli založil účet s cizím e-mailem a viděl cizí objednávky.
 *
 * Zároveň se prázdný profil doplní z nejnovější objednávky: jméno, telefon
 * a jedna uložená adresa — fakturační, protože u Balíkovny je doručovací
 * adresa výdejna. Co už člověk vyplnil, se nepřepisuje.
 */

type Adresa = {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}
type Objednavka = {
  id?: string
  created_at?: string | Date | null
  billing_address?: Adresa | null
  shipping_address?: Adresa | null
}
type Ucet = {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  addresses?: unknown[] | null
}

const uplna = (a?: Adresa | null): a is Adresa =>
  Boolean(a?.address_1 && a?.city && a?.postal_code && a?.country_code)

export const profilZObjednavky = (
  ucet: Ucet,
  objednavky: Objednavka[]
): { zakaznik: Record<string, string>; adresa: Adresa | null } => {
  const nejnovejsi = [...objednavky].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )[0]
  if (!nejnovejsi) return { zakaznik: {}, adresa: null }

  const zdroj = uplna(nejnovejsi.billing_address)
    ? nejnovejsi.billing_address
    : uplna(nejnovejsi.shipping_address)
      ? nejnovejsi.shipping_address
      : nejnovejsi.billing_address ?? nejnovejsi.shipping_address ?? null

  const zakaznik: Record<string, string> = {}
  if (!ucet.first_name && zdroj?.first_name) zakaznik.first_name = zdroj.first_name
  if (!ucet.last_name && zdroj?.last_name) zakaznik.last_name = zdroj.last_name
  const telefon = nejnovejsi.billing_address?.phone || nejnovejsi.shipping_address?.phone
  if (!ucet.phone && telefon) zakaznik.phone = telefon

  const adresa = !(ucet.addresses?.length) && uplna(zdroj)
    ? {
        first_name: zdroj.first_name ?? null,
        last_name: zdroj.last_name ?? null,
        company: zdroj.company ?? null,
        address_1: zdroj.address_1 ?? null,
        address_2: zdroj.address_2 ?? null,
        city: zdroj.city ?? null,
        postal_code: zdroj.postal_code ?? null,
        country_code: zdroj.country_code ?? null,
        phone: telefon ?? null,
      }
    : null

  return { zakaznik, adresa }
}

type Sluzby = {
  customers: {
    listCustomers: (filtr: Record<string, unknown>) => Promise<Array<{ id: string }>>
    retrieveCustomer: (id: string, config?: Record<string, unknown>) => Promise<any>
    updateCustomers: (id: string, data: Record<string, unknown>) => Promise<unknown>
    createCustomerAddresses: (data: Record<string, unknown>[]) => Promise<unknown>
  }
  orders: {
    listOrders: (filtr: Record<string, unknown>, config?: Record<string, unknown>) => Promise<Objednavka[]>
    updateOrders: (id: string, data: Record<string, unknown>) => Promise<unknown>
  }
}

export const pripojitObjednavkyHosta = async (
  ucetId: string,
  email: string,
  { customers, orders }: Sluzby
): Promise<{ pripojeno: number; profil: boolean }> => {
  const adresa = email.trim().toLowerCase()
  const hoste = await customers.listCustomers({ email: adresa, has_account: false })
  const idHostu = hoste.map((h) => h.id).filter((id) => id !== ucetId)
  if (!idHostu.length) return { pripojeno: 0, profil: false }

  const objednavky = await orders.listOrders(
    { customer_id: idHostu },
    { relations: ["billing_address", "shipping_address"], take: 500 }
  )
  for (const objednavka of objednavky) {
    if (objednavka.id) await orders.updateOrders(objednavka.id, { customer_id: ucetId })
  }

  const ucet = await customers.retrieveCustomer(ucetId, { relations: ["addresses"] })
  const { zakaznik, adresa: novaAdresa } = profilZObjednavky(ucet ?? {}, objednavky)
  if (Object.keys(zakaznik).length) await customers.updateCustomers(ucetId, zakaznik)
  if (novaAdresa) {
    await customers.createCustomerAddresses([
      {
        ...novaAdresa,
        customer_id: ucetId,
        address_name: "Z objednávky",
        is_default_shipping: true,
        is_default_billing: true,
      },
    ])
  }
  return {
    pripojeno: objednavky.length,
    profil: Boolean(Object.keys(zakaznik).length || novaAdresa),
  }
}
