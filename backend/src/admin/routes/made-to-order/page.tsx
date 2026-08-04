import { Navigate } from "react-router-dom";

/**
 * Compatibility redirect for the previous made-to-order location.
 *
 * The profile manager moved from `/made-to-order` to
 * `/zakazkova-vyroba/produkty` when Zakázková výroba became its own top-level
 * section (WorkflowPlan.md §2.2). Existing bookmarks keep working through this
 * route.
 *
 * There is **no** `config` export on purpose: a route without a `label` is never
 * added to the sidebar, so this does not appear as a duplicate entry next to
 * „Produkty na zakázku". Same pattern as the `/merchant-orders` redirect.
 */
const MadeToOrderRedirect = () => (
  <Navigate to="/zakazkova-vyroba/produkty" replace />
);

export default MadeToOrderRedirect;
