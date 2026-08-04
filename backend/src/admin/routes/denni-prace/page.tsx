import { Navigate } from "react-router-dom";

/**
 * Compatibility redirect. Denní práce moved from its own sidebar section into a tab of Přehled, so everything the merchant does in a day lives behind one item.
 *
 * No `config` export on purpose: a route without a label never becomes a
 * sidebar item, so this cannot show up as a duplicate entry.
 */
const Redirect = () => <Navigate to="/prehled/prace" replace />;

export default Redirect;
