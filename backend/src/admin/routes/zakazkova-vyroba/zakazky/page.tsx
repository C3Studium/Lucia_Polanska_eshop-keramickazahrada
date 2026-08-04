import { Navigate } from "react-router-dom";

/**
 * Compatibility redirect. Zakázky moved into the Přehled section, next to the order queues — it is work waiting for today, not made-to-order configuration.
 *
 * No `config` export on purpose: a route without a label never becomes a
 * sidebar item, so this cannot show up as a duplicate entry.
 */
const Redirect = () => <Navigate to="/prehled/zakazky" replace />;

export default Redirect;
