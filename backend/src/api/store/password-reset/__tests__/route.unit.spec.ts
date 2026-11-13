const run = jest.fn(async () => ({}))
jest.mock("@medusajs/core-flows", () => ({
  generateResetPasswordTokenWorkflow: () => ({ run }),
}))

import { POST } from "../route"

/**
 * Žádost o obnovu hesla s poctivou odpovědí (13. 11. 2026, Matěj): neznámá
 * adresa se dozví, že účet nemá — místo falešného „poslali jsme e-mail".
 */
const req = (identifier: unknown, o: { identity?: boolean; customers?: any[] } = {}) => {
  const services: Record<string, any> = {
    auth: {
      listProviderIdentities: jest.fn(async () => (o.identity ? [{ id: "pi" }] : [])),
      register: jest.fn(async () => ({ success: true, authIdentity: { id: "ai" } })),
      updateAuthIdentities: jest.fn(async () => ({})),
    },
    customer: { listCustomers: jest.fn(async () => o.customers ?? []) },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    configModule: { projectConfig: { http: { jwtSecret: "s", jwtOptions: {} } } },
  }
  return {
    body: { identifier },
    scope: {
      resolve: (key: string) =>
        key === "auth" ? services.auth
        : key === "customer" ? services.customer
        : key === "logger" ? services.logger
        : services.configModule,
    },
    services,
  } as any
}
const res = () => {
  const r: any = {}
  r.status = jest.fn(() => r)
  r.json = jest.fn(() => r)
  return r
}

beforeEach(() => run.mockClear())

describe("POST /store/password-reset", () => {
  it("registrovaný účet → odkaz se pošle", async () => {
    const r = res()
    await POST(req("a@b.cz", { identity: true }), r)
    expect(run).toHaveBeenCalledTimes(1)
    expect(r.json).toHaveBeenCalledWith({ status: "sent" })
  })

  it("host s objednávkami → založí přihlášení a pošle odkaz", async () => {
    const q = req("host@b.cz", { customers: [{ id: "cus_1", has_account: false }] })
    const r = res()
    await POST(q, r)
    expect(q.services.auth.register).toHaveBeenCalled()
    expect(run).toHaveBeenCalledTimes(1)
    expect(r.json).toHaveBeenCalledWith({ status: "sent" })
  })

  it("neznámá adresa → no-account a žádný e-mail", async () => {
    const r = res()
    await POST(req("nikdo@nikde.cz"), r)
    expect(run).not.toHaveBeenCalled()
    expect(r.json).toHaveBeenCalledWith({ status: "no-account" })
  })

  it("nesmyslná adresa → 400", async () => {
    const r = res()
    await POST(req("bez-zavinace"), r)
    expect(r.status).toHaveBeenCalledWith(400)
    expect(run).not.toHaveBeenCalled()
  })
})
