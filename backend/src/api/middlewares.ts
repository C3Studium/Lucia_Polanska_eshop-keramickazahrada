import {
  defineMiddlewares,
  validateAndTransformBody,
  authenticate,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { PostCustomPriceSchema } from "./store/variants/[id]/price/route";
import { PostStoreReviewSchema } from "./store/reviews/route";
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
    // Customer reviews - rely on Medusa's internal auth for /store/customers/me/*
    {
      matcher: "/store/customers/me/reviews",
      methods: ["GET"],
      middlewares: [debugAuthMiddleware()],
    },
  ],
});
