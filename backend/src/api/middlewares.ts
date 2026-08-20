import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
  authenticate,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { PostCustomPriceSchema } from "./store/variants/[id]/price/route";
import { PostStoreReviewSchema } from "./store/reviews/route";
import { PostStoreRestockSubscriptionSchema } from "./store/restock-subscriptions/route";
import { PostWorkbenchBatchStageSchema } from "./admin/workbench/orders/batch-stage/route";
import { GetStoreReviewsSchema } from "./store/products/[id]/reviews/route";
import { GetStoreCustomerReviewsSchema } from "./store/customers/me/reviews/route";
import { GetAdminReviewsSchema } from "./admin/reviews/route";
import { PostAdminUpdateReviewsStatusSchema } from "./admin/reviews/status/route";
import { PostAddCustomLineItemSchema } from "./store/carts/[id]/line-items-custom/route";
import { PostBundledProductsSchema } from "./admin/bundled-products/route";
import { PatchBundledProductsSchema } from "./admin/bundled-products/[id]/route";
import { PostCartsBundledLineItemsSchema } from "./store/carts/[id]/line-item-bundles/route";
import {
  GetMerchantCollectionsSchema,
  PostMerchantCollectionSchema,
} from "./admin/merchant-catalog/collections/route";
import { PatchMerchantCollectionSchema } from "./admin/merchant-catalog/collections/[id]/route";
import { GetMerchantCategoriesSchema } from "./admin/merchant-catalog/categories/route";
import {
  GetSeasonalSelectionsSchema,
  PostSeasonalSelectionSchema,
} from "./admin/merchant-catalog/seasonal-selections/route";
import { PatchSeasonalSelectionSchema } from "./admin/merchant-catalog/seasonal-selections/[id]/route";
import { PostSeasonalDiscountSchema } from "./admin/merchant-catalog/seasonal-selections/[id]/discount/route";
import { GetStoreMerchantCatalogSchema } from "./store/merchant-catalog/route";
import { requireShipGate } from "../lib/require-ship-gate";
import {
  blockEmptyingConfirm,
  blockMtoLineEdits,
  blockMtoVariantAdds,
} from "../lib/native-order-edit-guard";
import { PostProductionPaymentModeSchema } from "./store/carts/[id]/production-payment-mode/route";
import { PostStoreNewsletterSchema } from "./store/newsletter/validators";
import { PostNewsletterCampaignSchema } from "./admin/newsletter/campaigns/route";
import { PostAnnounceBundleSchema } from "./admin/newsletter/announce-bundle/route";
import { PostNewsletterPreviewSchema } from "./admin/newsletter/preview/route";
import { PostNewsletterTestSchema } from "./admin/newsletter/test/route";
import { PostNewsletterDraftSchema } from "./admin/newsletter/drafts/route";

export default defineMiddlewares({
  routes: [
    // The customer-route order-edit rules, on the native admin endpoints too —
    // a rule enforced on one door only gets walked around (see the guard file).
    {
      matcher: "/admin/order-edits/:id/items/item/:item_id",
      methods: ["POST", "DELETE"],
      middlewares: [blockMtoLineEdits()],
    },
    {
      matcher: "/admin/order-edits/:id/items",
      methods: ["POST"],
      middlewares: [blockMtoVariantAdds()],
    },
    {
      matcher: "/admin/order-edits/:id/request",
      methods: ["POST"],
      middlewares: [blockEmptyingConfirm()],
    },
    {
      matcher: "/admin/order-edits/:id/confirm",
      methods: ["POST"],
      middlewares: [blockEmptyingConfirm()],
    },
    // The A2 payment invariant on the *native* fulfilment routes.
    //
    // The queue already refuses to dispatch an unpaid order, but it is not the
    // only door: the native order page creates fulfilments and shipments
    // directly, and so does anything holding an admin token. Enforcing a money
    // rule on one screen only means it will eventually be walked around.
    //
    // Middleware is the only option — `createOrderFulfillmentWorkflow` exposes
    // just a post-hoc `fulfillmentCreated` hook, which runs after inventory has
    // already moved. The rules are the shared ones from `lib/ship-gate`, so
    // this cannot drift from what the queue enforces.
    {
      matcher: "/admin/orders/:id/fulfillments",
      methods: ["POST"],
      middlewares: [requireShipGate()],
    },
    {
      matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/shipments",
      methods: ["POST"],
      middlewares: [requireShipGate()],
    },
    {
      matcher: "/admin/bundled-products",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PostBundledProductsSchema),
      ],
    },
    {
      matcher: "/admin/bundled-products",
      methods: ["GET"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/bundled-products/:id",
      methods: ["PATCH"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PatchBundledProductsSchema),
      ],
    },
    {
      matcher: "/admin/bundled-products/:id",
      methods: ["GET", "DELETE"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/merchant-catalog/collections",
      methods: ["GET"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformQuery(GetMerchantCollectionsSchema, {
          isList: true,
          defaults: [],
        }),
      ],
    },
    {
      matcher: "/admin/merchant-catalog/collections",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PostMerchantCollectionSchema),
      ],
    },
    {
      matcher: "/admin/merchant-catalog/collections/:id",
      methods: ["GET", "DELETE"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/merchant-catalog/collections/:id",
      methods: ["PATCH"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PatchMerchantCollectionSchema),
      ],
    },
    {
      matcher: "/admin/merchant-catalog/categories",
      methods: ["GET"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformQuery(GetMerchantCategoriesSchema, {
          isList: true,
          defaults: [],
        }),
      ],
    },
    {
      matcher: "/admin/merchant-catalog/seasonal-selections",
      methods: ["GET"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformQuery(GetSeasonalSelectionsSchema, {
          isList: true,
          defaults: [],
        }),
      ],
    },
    {
      matcher: "/admin/merchant-catalog/seasonal-selections",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PostSeasonalSelectionSchema),
      ],
    },
    {
      matcher: "/admin/merchant-catalog/seasonal-selections/:id",
      methods: ["GET", "DELETE"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/merchant-catalog/seasonal-selections/:id",
      methods: ["PATCH"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PatchSeasonalSelectionSchema),
      ],
    },
    {
      matcher: "/admin/merchant-catalog/seasonal-selections/:id/discount",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(PostSeasonalDiscountSchema)],
    },
    {
      matcher: "/store/merchant-catalog",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetStoreMerchantCatalogSchema, {
          isList: false,
          defaults: [],
        }),
      ],
    },
    {
      matcher: "/store/carts/:id/production-payment-mode",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(PostProductionPaymentModeSchema)],
    },
    // Newsletter. Note that the unsubscribe link in e-mails points at the
    // top-level GET /newsletter/unsubscribe, *not* /store/... — the framework
    // demands a publishable key on the whole /store namespace with no
    // per-route exemption, and a mail client sends no headers. That route
    // needs no entry here: it is token-gated in the handler itself.
    {
      matcher: "/store/newsletter",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(PostStoreNewsletterSchema)],
    },
    {
      matcher: "/admin/newsletter/campaigns",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PostNewsletterCampaignSchema),
      ],
    },
    {
      matcher: "/admin/newsletter/campaigns",
      methods: ["GET"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/newsletter/preview",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PostNewsletterPreviewSchema),
      ],
    },
    {
      matcher: "/admin/newsletter/test",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PostNewsletterTestSchema),
      ],
    },
    {
      matcher: "/admin/newsletter/announce-bundle",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PostAnnounceBundleSchema),
      ],
    },
    {
      matcher: "/admin/newsletter/subscribers",
      methods: ["GET"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    // Delivery reports from the mail service. Public and token-free by
    // design — the handler authenticates every request itself via the
    // signature over the *raw* body, and that raw body only exists when this
    // entry asks the body parser to keep it (same mechanism Medusa core uses
    // for /hooks/payment/:provider).
    {
      matcher: "/hooks/newsletter-events",
      methods: ["POST"],
      bodyParser: { preserveRawBody: true },
      middlewares: [],
    },
    // Composer drafts (autosave).
    {
      matcher: "/admin/newsletter/drafts",
      methods: ["GET"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/newsletter/drafts",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PostNewsletterDraftSchema),
      ],
    },
    {
      matcher: "/admin/newsletter/drafts/:id",
      methods: ["DELETE"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/newsletter/campaigns/:key/stats",
      methods: ["GET"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    // iDoklad invoicing — custom admin routes, explicitly authenticated like
    // the other admin actions here. No body schemas: the handlers take no
    // input beyond the order id in the path.
    {
      matcher: "/admin/idoklad/orders/:orderId",
      methods: ["GET"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/idoklad/orders/:orderId/issue",
      methods: ["POST"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/idoklad/orders/:orderId/mark-paid",
      methods: ["POST"],
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/store/carts/:id/line-item-bundles",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(PostCartsBundledLineItemsSchema)],
    },
    {
      matcher: "/store/variants/:id/price",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(PostCustomPriceSchema)],
    },
    {
      // The handler reads `req.validatedBody`, which does not exist until this
      // runs. Without this entry every request 500s on the first property
      // access — which is exactly what it did.
      matcher: "/store/restock-subscriptions",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(PostStoreRestockSubscriptionSchema)],
    },
    {
      matcher: "/store/reviews",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["bearer", "session"]),
        validateAndTransformBody(PostStoreReviewSchema),
      ],
    },
    {
      matcher: "/store/products/:id/reviews",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetStoreReviewsSchema, {
          isList: true,
          defaults: [
            "id",
            "title",
            "content",
            "rating",
            "first_name",
            "last_name",
            "status",
            "product_id",
            "created_at",
          ],
        }),
      ],
    },
    {
      matcher: "/admin/reviews",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetAdminReviewsSchema, {
          isList: true,
          defaults: [
            "id",
            "title",
            "content",
            "rating",
            "first_name",
            "last_name",
            "product_id",
            "customer_id",
            "status",
            "created_at",
            "updated_at",
            "product.*",
          ],
        }),
      ],
    },
    {
      matcher: "/admin/reviews/status",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostAdminUpdateReviewsStatusSchema),
      ],
    },
    {
      matcher: "/store/customers/delete-account",
      methods: ["POST"],
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/carts/:id/line-items-custom",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(PostAddCustomLineItemSchema)],
    },
    // Wishlist routes rely on Medusa's internal auth for /store/customers/me/*.
    {
      // Batch moves read validatedBody — without this entry the handler
      // throws on first access, the restock lesson.
      matcher: "/admin/workbench/orders/batch-stage",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        validateAndTransformBody(PostWorkbenchBatchStageSchema),
      ],
    },
    // An order's progress is private to whoever placed it. Custom store routes
    // are not authenticated by default, so without this the merchant stage and
    // the outstanding balance of any order id would be readable by anyone.
    {
      matcher: "/store/orders/:id/request-tweak",
      methods: ["POST"],
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/orders/:id/progress",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Course reservations: auth is *optional* — a logged-in booker gets
    // linked to their account (customer_id lands on the reservation), a guest
    // passes through untouched. Validation is inline in the handler.
    {
      matcher: "/store/courses/reservations",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["bearer", "session"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    // Self-service on one reservation (cancel, party-size edit): the signed
    // token in the query is proof enough on its own, but a logged-in customer
    // acting from their account may arrive without it — optional auth lets
    // the handler accept either proof (see the routes' self-service helper).
    {
      matcher: "/store/courses/reservations/:id/cancel",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["bearer", "session"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    {
      matcher: "/store/courses/reservations/:id/edit",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["bearer", "session"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    // Customer reviews are explicitly authenticated because this is a custom
    // route and its query contains private, customer-scoped review records.
    {
      matcher: "/store/customers/me/reviews",
      methods: ["GET"],
      middlewares: [
        authenticate("customer", ["bearer", "session"]),
        validateAndTransformQuery(GetStoreCustomerReviewsSchema, {
          isList: true,
          defaults: [
            "id",
            "title",
            "content",
            "rating",
            "first_name",
            "last_name",
            "status",
            "product_id",
            "created_at",
            "updated_at",
          ],
        }),
      ],
    },
  ],
});
