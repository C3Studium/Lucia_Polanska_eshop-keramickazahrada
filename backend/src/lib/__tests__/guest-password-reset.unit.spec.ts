import { zalozPrihlaseniProHosta } from "../guest-password-reset"

/**
 * Obnova hesla pro hosta (13. 11. 2026): kdo nakupoval bez účtu, nemá heslo,
 * a „Zapomněli jste heslo?" mu dřív neposlalo nic. Teď se mu k existujícímu
 * záznamu zákazníka založí přihlášení (náhodné heslo) a pošle se běžný odkaz
 * na nastavení hesla.
 */
const fakes = (o: { identity?: boolean; customers?: any[] } = {}) => {
  const calls: any[] = []
  return {
    calls,
    auth: {
      listProviderIdentities: jest.fn(async () => (o.identity ? [{ id: "pi_1" }] : [])),
      register: jest.fn(async (_p: string, data: any) => {
        calls.push(["register", data.body.email, typeof data.body.password])
        return { success: true, authIdentity: { id: "authid_1" } }
      }),
      updateAuthIdentities: jest.fn(async (data: any) => { calls.push(["update", data]) }),
    },
    customers: { listCustomers: jest.fn(async () => o.customers ?? []) },
  }
}

describe("zalozPrihlaseniProHosta", () => {
  it("host bez přihlášení dostane přihlášení navázané na svůj záznam", async () => {
    const f = fakes({ customers: [{ id: "cus_1", has_account: false }] })
    expect(await zalozPrihlaseniProHosta("Host@Mail.cz ", f)).toBe("zalozeno")
    expect(f.calls[0]).toEqual(["register", "host@mail.cz", "string"])
    expect(f.calls[1]).toEqual(["update", { id: "authid_1", app_metadata: { customer_id: "cus_1" } }])
  })

  it("kdo přihlášení má, tomu se nic nezakládá", async () => {
    const f = fakes({ identity: true, customers: [{ id: "cus_1", has_account: true }] })
    expect(await zalozPrihlaseniProHosta("a@b.cz", f)).toBe("existuje")
    expect(f.auth.register).not.toHaveBeenCalled()
  })

  it("neznámá adresa nezaloží nic (stejná odpověď navenek)", async () => {
    const f = fakes()
    expect(await zalozPrihlaseniProHosta("nikdo@nikde.cz", f)).toBe("neni-zakaznik")
    expect(f.auth.register).not.toHaveBeenCalled()
  })

  it("zákazník s účtem, ale bez přihlášení (nemělo by nastat) — nic se nezakládá", async () => {
    const f = fakes({ customers: [{ id: "cus_1", has_account: true }] })
    expect(await zalozPrihlaseniProHosta("a@b.cz", f)).toBe("neni-zakaznik")
  })
})
