/**
 * The same unsubscribe handler, reachable with a publishable key.
 *
 * The canonical link in e-mails points at the top-level
 * `/newsletter/unsubscribe` (see that route for why: the `/store` namespace
 * demands `x-publishable-api-key` on every request and a mail client sends no
 * headers). This re-export keeps the documented `/store` path working for the
 * storefront or anything else that does carry the key.
 */
export { GET } from "../../../newsletter/unsubscribe/route"
