import jwt from "jsonwebtoken"
import { emailZTokenuObnovy, overitEmailPoObnove } from "../reset-overi-email"

describe("emailZTokenuObnovy — kdo si právě nastavil heslo z e-mailu", () => {
  const SECRET = "tajne"
  it("platný token obnovy vrátí e-mail", () => {
    const token = jwt.sign({ entity_id: "jana@example.cz", provider: "emailpass", actor_type: "customer" }, SECRET)
    expect(emailZTokenuObnovy(token, SECRET)).toBe("jana@example.cz")
  })
  it("cizí podpis, zákazník jiného typu nebo nesmysl = nic", () => {
    expect(emailZTokenuObnovy(jwt.sign({ entity_id: "jana@example.cz", actor_type: "customer" }, "jine"), SECRET)).toBeNull()
    expect(emailZTokenuObnovy(jwt.sign({ entity_id: "admin@x.cz", actor_type: "user" }, SECRET), SECRET)).toBeNull()
    expect(emailZTokenuObnovy("nesmysl", SECRET)).toBeNull()
    expect(emailZTokenuObnovy(undefined, SECRET)).toBeNull()
  })
})

describe("overitEmailPoObnove — odkaz z e-mailu prokázal, že schránka je jeho", () => {
  it("označí účet jako ověřený a zahodí čekající ověřovací token", async () => {
    const updates: any[] = []
    const customers = {
      listCustomers: async () => [
        { id: "cus_1", has_account: true, metadata: { email_verified: false, email_verification_token: "x", jine: 1 } },
      ],
      updateCustomers: async (id: string, data: any) => updates.push([id, data]),
    }
    await overitEmailPoObnove("jana@example.cz", customers as any)
    expect(updates).toEqual([
      ["cus_1", { metadata: { email_verified: true, email_verification_token: null, email_verification_expires_at: null, jine: 1 } }],
    ])
  })
  it("host s přihlášením z obnovy (has_account false) se ověří taky", async () => {
    const updates: any[] = []
    let filtr: any = null
    const customers = {
      listCustomers: async (f: any) => {
        filtr = f
        return [{ id: "cus_host", has_account: false, metadata: null }]
      },
      updateCustomers: async (id: string, data: any) => updates.push([id, data]),
    }
    await overitEmailPoObnove("jana@example.cz", customers as any)
    expect(filtr).toEqual({ email: "jana@example.cz" })
    expect(updates[0][0]).toBe("cus_host")
    expect(updates[0][1].metadata.email_verified).toBe(true)
  })
  it("už ověřený účet nechá být", async () => {
    const updates: any[] = []
    const customers = {
      listCustomers: async () => [{ id: "cus_1", has_account: true, metadata: { email_verified: true } }],
      updateCustomers: async (id: string, data: any) => updates.push([id, data]),
    }
    await overitEmailPoObnove("jana@example.cz", customers as any)
    expect(updates).toEqual([])
  })
})
