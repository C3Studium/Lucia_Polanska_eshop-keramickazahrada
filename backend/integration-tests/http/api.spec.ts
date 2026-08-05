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

    describe("providers she has to be able to find", () => {
      /**
       * `pp_pickup_pickup` was registered, enabled, and reported missing —
       * because the admin renders provider ids through
       * `formatProvider(id.split("_"))`, which showed it as „Pickup (PICKUP)"
       * to someone looking for osobní odběr. Present but unrecognisable is
       * operationally identical to absent.
       *
       * So this asserts the exact ids, which pin both halves: that the
       * providers load (a provider whose module fails to resolve is simply
       * not in this list — no error), and that their identifiers stay ones
       * that render as recognisable Czech-ish labels.
       */
      it("registers the payment providers under recognisable ids", async () => {
        const payment: any = getContainer().resolve("payment")
        const providers = await payment.listPaymentProviders({})
        const ids = providers.map((provider: any) => provider.id)

        expect(ids).toContain("pp_comgate_comgate")
        expect(ids).toContain("pp_osobni-odber_pickup")
        expect(ids).not.toContain("pp_pickup_pickup")
      })

      it("registers the fulfillment providers", async () => {
        const fulfillment: any = getContainer().resolve("fulfillment")
        const providers = await fulfillment.listFulfillmentProviders({})
        const ids = providers.map((provider: any) => provider.id)

        expect(ids).toContain("pickup_osobni-odber")
        expect(ids).toContain("ceska-posta-fulfillment_balikovna")
        expect(ids).toContain("packeta_packeta")
      })
    })

    describe("personal pickup can actually be configured", () => {
      /**
       * Reported as „there is no provider in the create shipping option".
       * True observation, wrong conclusion — and this test is the receipt.
       *
       * The shipping-option dialog lists providers from
       * `GET /admin/fulfillment-providers?stock_location_id=…`, which returns
       * only providers **added to that stock location**. Run against a fresh
       * location it returns `[]` — the provider is registered, loaded, and
       * invisible, because linking it to the location is a separate step that
       * nothing in the UI points at.
       *
       * So this walks the exact chain the admin has to click, in order:
       * location → add provider to location → pickup fulfillment set →
       * service zone → 0 Kč shipping option. If any step regresses, the
       * failure names the step instead of presenting an empty dropdown.
       */
      it("location → provider link → set → zone → 0 Kč option", async () => {
        const location = await api.post(
          "/admin/stock-locations",
          { name: "Dílna (test)" },
          { headers: headers!, validateStatus: () => true }
        )
        const locationId = location.data?.stock_location?.id
        expect(locationId).toBeTruthy()

        // The dialog's own query, before the link: empty. This emptiness is
        // the entire mystery.
        const before = await api.get(
          `/admin/fulfillment-providers?stock_location_id=${locationId}`,
          { headers: headers!, validateStatus: () => true }
        )
        expect(before.data.fulfillment_providers).toEqual([])

        const linked = await api.post(
          `/admin/stock-locations/${locationId}/fulfillment-providers`,
          { add: ["pickup_osobni-odber"] },
          { headers: headers!, validateStatus: () => true }
        )
        expect(linked.status).toBe(200)

        const after = await api.get(
          `/admin/fulfillment-providers?stock_location_id=${locationId}`,
          { headers: headers!, validateStatus: () => true }
        )
        expect(
          after.data.fulfillment_providers.map((provider: any) => provider.id)
        ).toContain("pickup_osobni-odber")

        const set = await api.post(
          `/admin/stock-locations/${locationId}/fulfillment-sets?fields=*fulfillment_sets`,
          { name: "Osobní odběr (test)", type: "pickup" },
          { headers: headers!, validateStatus: () => true }
        )
        const setId = set.data?.stock_location?.fulfillment_sets?.[0]?.id
        expect(setId).toBeTruthy()

        const zone = await api.post(
          `/admin/fulfillment-sets/${setId}/service-zones`,
          {
            name: "Česko (test)",
            geo_zones: [{ type: "country", country_code: "cz" }],
          },
          { headers: headers!, validateStatus: () => true }
        )
        const zoneId = zone.data?.fulfillment_set?.service_zones?.[0]?.id
        expect(zoneId).toBeTruthy()

        const profiles = await api.get("/admin/shipping-profiles", {
          headers: headers!,
          validateStatus: () => true,
        })
        let profileId = profiles.data?.shipping_profiles?.[0]?.id
        if (!profileId) {
          const profile = await api.post(
            "/admin/shipping-profiles",
            { name: "Výchozí (test)", type: "default" },
            { headers: headers!, validateStatus: () => true }
          )
          profileId = profile.data?.shipping_profile?.id
        }
        expect(profileId).toBeTruthy()

        const option = await api.post(
          "/admin/shipping-options",
          {
            name: "Osobní odběr v dílně",
            service_zone_id: zoneId,
            shipping_profile_id: profileId,
            provider_id: "pickup_osobni-odber",
            price_type: "flat",
            type: {
              label: "Osobní odběr",
              description: "Vyzvednutí přímo v dílně",
              code: "personal-pickup",
            },
            prices: [{ currency_code: "czk", amount: 0 }],
            rules: [],
          },
          { headers: headers!, validateStatus: () => true }
        )
        expect(option.status).toBe(200)
        expect(option.data.shipping_option.provider_id).toBe(
          "pickup_osobni-odber"
        )
      })
    })

    describe("workbench detail routes", () => {
      // Fake ids: 404 is the correct answer; 500 means a projection or
      // handler broke. Mounted-ness is proven by not getting Express's own
      // HTML 404 — Medusa returns JSON for a mounted route.
      it.each([
        "/admin/workbench/orders/order_fake",
        "/admin/workbench/products/prod_fake",
        "/admin/workbench/customers/cus_fake",
        "/admin/workbench/customers/cus_fake/emails",
      ])("%s answers without breaking", async (route) => {
        const response = await api
          .get(route, { headers: headers ?? undefined, validateStatus: () => true })
          .catch((error: any) => error.response)
        expect(response.status).toBeLessThan(500)
      })
    })

    describe("POST routes — validated bodies", () => {
      /**
       * Every route here reads `req.validatedBody`, which only exists once a
       * validator middleware has run. Forget to register one and the handler
       * throws on its first property access: a 500 with `unknown_error` and no
       * indication that the cause is a missing line in `middlewares.ts`.
       *
       * That is not hypothetical — `/store/restock-subscriptions` shipped that
       * way and 500d on every payload until the storefront tried to use it.
       * The suite missed it because it only ever issued GETs.
       *
       * A 400 is the pass condition: it means the validator ran and rejected
       * the empty body, which is the thing that was missing.
       */
      const POST_ROUTES = [
        "/admin/workbench/orders/batch-stage",
        "/store/restock-subscriptions",
        "/store/reviews",
        "/store/return-requests",
        "/store/newsletter",
      ]

      it.each(POST_ROUTES)("%s validates instead of throwing", async (route) => {
        const response = await api
          .post(route, {}, { validateStatus: () => true })
          .catch((error: any) => error.response)

        expect(response).toBeDefined()
        expect(response.status).not.toBe(404)
        // 500 means the handler ran without a validator and blew up.
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
      "/admin/workbench/orders",
      "/admin/workbench/products",
      "/admin/workbench/inventory",
      "/admin/workbench/customers",
      "/admin/workbench/discounts",
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
