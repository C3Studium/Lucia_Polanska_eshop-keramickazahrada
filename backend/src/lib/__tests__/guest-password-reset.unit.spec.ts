import { stavAdresy } from "../guest-password-reset"

const sluzby = (o: { identity?: boolean; customers?: any[] }) => ({
  auth: { listProviderIdentities: jest.fn(async () => (o.identity ? [{ id: "pi" }] : [])) },
  customers: { listCustomers: jest.fn(async () => o.customers ?? []) },
})

describe("stavAdresy — komu jde obnova hesla (14. 11. 2026)", () => {
  it("adresa s přihlášením je účet", async () => {
    expect(await stavAdresy("A@b.cz ", sluzby({ identity: true }) as any)).toBe("ucet")
  })
  it("jen nákup bez účtu je host — nic se nezakládá", async () => {
    const s = sluzby({ customers: [{ id: "cus_1", has_account: false }] })
    expect(await stavAdresy("host@b.cz", s as any)).toBe("host")
    expect(s.customers.listCustomers).toHaveBeenCalledWith({ email: "host@b.cz" })
  })
  it("neznámá adresa", async () => {
    expect(await stavAdresy("nikdo@nikde.cz", sluzby({}) as any)).toBe("nikdo")
  })
})
