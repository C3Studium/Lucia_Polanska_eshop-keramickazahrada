import { Navigate } from "react-router-dom";

/**
 * Compatibility redirect for the previous Denní práce location.
 *
 * The queue moved from `/merchant-orders` to `/prehled/prace` — first out of the
 * core Orders item, then into the Přehled section when it stopped being nested
 * under the core Orders item. Existing bookmarks and any link the client already saved
 * keep working through this route.
 *
 * There is **no** `config` export on purpose: a route without a `label` is never added to
 * the sidebar, so this does not appear as a duplicate entry next to "Denní práce".
 */
const MerchantOrdersRedirect = () => <Navigate to="/prehled/prace" replace />;

export default MerchantOrdersRedirect;
