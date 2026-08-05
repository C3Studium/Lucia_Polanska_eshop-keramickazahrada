/**
 * Top-level alias of `GET /store/made-to-order/{orderId}/pay-balance`.
 *
 * The `/store` namespace requires `x-publishable-api-key` on every request
 * (mounted by the framework before any custom middleware, with no opt-out),
 * and a mail client's GET carries no headers — so the button in the balance
 * e-mails could never open the original route. E-mail links are built against
 * this path instead (`lib/balance-payment-link.ts`); the `/store` route stays
 * for callers that do carry the key. Same pattern as `/newsletter/unsubscribe`.
 */
export { GET } from "../../../store/made-to-order/[orderId]/pay-balance/route"
