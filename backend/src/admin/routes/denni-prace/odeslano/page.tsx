import { Navigate } from "react-router-dom";

/**
 * Compatibility redirect. The queue moved into the Přehled section; the stage is now a tab.
 *
 * No `config` export on purpose: a route without a label never becomes a
 * sidebar item, so this cannot show up as a duplicate entry.
 */
const Redirect = () => <Navigate to="/prehled/prace?krok=odeslano" replace />;

export default Redirect;
