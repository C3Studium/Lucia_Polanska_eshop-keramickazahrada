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
import { GetStoreReviewsSchema } from "./store/products/[id]/reviews/route";
import { GetStoreCustomerReviewsSchema } from "./store/customers/me/reviews/route";
import { GetAdminReviewsSchema } from "./admin/reviews/route";
import { PostAdminUpdateReviewsStatusSchema } from "./admin/reviews/status/route";
import { PostAddCustomLineItemSchema } from "./store/carts/[id]/line-items-custom/route";

// Debug middleware to log incoming requests
const debugAuthMiddleware = () => {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    console.log("[Middleware Debug] Path:", req.path);
    console.log("[Middleware Debug] Method:", req.method);
    console.log(
      "[Middleware Debug] Authorization header present:",
      !!req.headers.authorization
    );
    console.log("[Middleware Debug] auth_context:", (req as any).auth_context);
    next();
  };
};

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/variants/:id/price",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(PostCustomPriceSchema)],
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
    // Wishlist routes - rely on Medusa's internal auth for /store/customers/me/*
    // Added debug middleware to verify requests reach here
    {
      matcher: "/store/customers/me/wishlists",
      methods: ["GET", "POST"],
      middlewares: [debugAuthMiddleware()],
    },
    {
      matcher: "/store/customers/me/wishlists/items",
      methods: ["GET", "POST"],
      middlewares: [debugAuthMiddleware()],
    },
    {
      matcher: "/store/customers/me/wishlists/items/:id",
      methods: ["DELETE"],
      middlewares: [debugAuthMiddleware()],
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
