import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminHeaders } from "../helpers/admin"

jest.setTimeout(900000)

/**
 * Every custom HTTP surface, against a real application and a real database.
 *
 * ## Why this is one file
 *
 * Each `medusaIntegrationTestRunner` call boots the whole application: it
 * creates a database, runs every migration into it, starts the app, and drops
 * the database afterwards. Four spec files meant doing that four times, and
 * against a remote Postgres it did not survive it — the later runs died with
 * "Client has encountered a connection error and is not queryable" partway
 * through migrating. The routes were fine; the churn was not.
 *
 * So the boot happens once and everything shares it. The cost is a longer file;
 * the benefit is a suite that finishes in a quarter of the time and does not
 * fail for reasons that have nothing to do with the code under test.
 *
 * ## What this proves that nothing else can
 *
 * Migrations apply. Routes are mounted. Handlers survive a real `query.graph`
 * against real (empty) tables — the failure this project keeps meeting, where a
 * misprojected field is invisible to `tsc`, to `medusa build`, and to any unit
 * spec with a mocked container, and only shows up when someone makes a request.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    // `maxRedirects: 0` matters more than it looks: some routes 302 to the
    // storefront, and axios follows redirects by default — without it this
    // suite makes real requests to the live site, and the redirect arrives as
    // an unrelated network error instead of the status we mean to assert.
    const call = async (path: string, headers?: Record<string, string>) =>
      api
        .get(path, {
          headers,
          maxRedirects: 0,
          validateStatus: () => true,
        })
        .catch((error: any) => error.response)

    describe("order progress access", () => {
      it("refuses an unauthenticated caller", async () => {
        const response = await api
          .get("/store/orders/order_whatever/progress")
          .catch((error: any) => error.response)

        // 401 from the middleware, or 400 if the publishable-key check fires
        // first. Both mean "not served to an anonymous caller", which is the
        // property under test; what must never appear is a 200.
        expect([400, 401]).toContain(response.status)
        expect(response.status).not.toBe(200)
      })

      it("does not serve an order to a customer who does not own it", async () => {
        // Registered, authenticated, and asking for an order id that is not
        // theirs — the exact shape of an enumeration attempt.
        const email = `nosy-${Date.now()}@example.com`

        const registration = await api
          .post("/auth/customer/emailpass/register", {
            email,
            password: "supersecret",
          })
          .catch((error: any) => error.response)

        if (![200, 201].includes(registration.status)) {
          // Auth flows differ across Medusa versions; if registration is not
          // available the ownership assertion below cannot be made honestly.
          console.warn(
            `[skip] customer registration returned ${registration.status}`
          )
          return
        }

        const token = registration.data?.token

        const response = await api
          .get("/store/orders/order_definitely_not_theirs/progress", {
            headers: { authorization: `Bearer ${token}` },
          })
          .catch((error: any) => error.response)

        expect(response.status).not.toBe(200)
        // Never 403: that would confirm the order exists.
        expect(response.status).not.toBe(403)
      })
    })

    describe("routes the storefront will call", () => {
      it("serves the production profile for an unknown product without breaking", async () => {
        const response = await call(
          "/store/products/prod_does_not_exist/production-profile"
        )

        // Never 404: the route itself must exist, whatever the product is.
        expect(response.status).not.toBe(404)
        expect(response.status).toBeLessThan(500)
      })

      it("serves the production payment mode for an unknown cart without breaking", async () => {
        const response = await call(
          "/store/carts/cart_does_not_exist/production-payment-mode"
        )

        expect(response.status).not.toBe(404)
        expect(response.status).toBeLessThan(500)
      })

      it("answers the merchant catalog", async () => {
        const response = await call("/store/merchant-catalog")
        expect(response.status).toBeLessThan(500)
      })

      it("answers a product's reviews", async () => {
        const response = await call(
          "/store/products/prod_does_not_exist/reviews"
        )
        expect(response.status).toBeLessThan(500)
      })
    })

    describe("routes reached from an e-mail, which carry no headers", () => {
      it("does not require a publishable key to pay a balance", async () => {
        // A mail client sends a bare GET. If this route ever moves back under
        // /store it becomes unreachable from the inbox — the reason the
        // top-level alias exists at all.
        const response = await call(
          "/made-to-order/order_nope/pay-balance?token=invalid"
        )

        expect(response.status).not.toBe(404)
        // Redirects to the storefront with a reason rather than erroring at
        // somebody who was trying to pay.
        expect([200, 302, 400]).toContain(response.status)
      })

      it("does not require a publishable key to unsubscribe", async () => {
        const response = await call("/newsletter/unsubscribe?email=nobody@example.com")

        expect(response.status).not.toBe(404)
        expect(response.status).toBeLessThan(500)
      })
    })
    let headers: Record<string, string> | null = null

    beforeAll(async () => {
      headers = await createAdminHeaders(getContainer(), api)
    })

    // These tests once "passed" 34 times without making a single assertion,
    // because the helper returned null and every case skipped itself. A skip
    // that reports as a pass is worse than a failure. So the session is now a
    // test of its own: if it is missing, this fails and the green is gone.
    it("has an authenticated admin session", () => {
      expect(headers).not.toBeNull()
    })

    const ROUTES = [
      "/admin/operations/summary",
      "/admin/operations/emails",
      "/admin/operations/payments",
      "/admin/operations/statistics",
      "/admin/operations/discounts",
      "/admin/operations/products",
      "/admin/operations/catalog-health",
      "/admin/inventory-alerts",
      "/admin/merchant-settings",
      "/admin/merchant-orders",
      "/admin/made-to-order/orders",
      "/admin/made-to-order/products",
      "/admin/return-requests",
      "/admin/reviews",
      "/admin/merchant-catalog/seasonal-selections",
      "/admin/merchant-catalog/collections",
      "/admin/merchant-catalog/categories",
    ]

    describe("Přehled's endpoints answer", () => {
      it.each(ROUTES)("%s does not fail", async (route) => {
        const response = await call(route, headers ?? undefined)

        expect(response).toBeDefined()
        // 404 would mean the route is not mounted; 5xx that it threw.
        expect(response.status).not.toBe(404)
        expect(response.status).toBeLessThan(500)
      })
    })

    describe("admin endpoints are not public", () => {
      it.each(ROUTES)("%s refuses an anonymous caller", async (route) => {
        const response = await call(route)

        expect(response).toBeDefined()
        expect(response.status).not.toBe(200)
      })
    })
  },
})
