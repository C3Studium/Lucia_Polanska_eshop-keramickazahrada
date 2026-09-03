/**
 * The readable companion to the real admin cookie.
 *
 * The signed cookie is httpOnly, so client code cannot see it — which is the
 * point. But the bar runs on the client (product pages are static; see
 * `app/api/admin-bridge/status`), and without some marker every visitor would
 * fire a status request on every page load just so one person can have a bar.
 *
 * So the bridge sets this second, deliberately readable cookie next to the
 * real one. It carries no claim and grants nothing: forging it buys you one
 * request that answers `admin: false`. It exists purely so the other 99.9% of
 * visitors make no request at all.
 */
export const ADMIN_BRIDGE_HINT_COOKIE = "kz_admin_hint"
