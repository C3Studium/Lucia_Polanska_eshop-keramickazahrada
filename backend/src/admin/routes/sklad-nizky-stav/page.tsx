import { Navigate } from "react-router-dom";

/**
 * Compatibility redirect. This list moved into Přehled → Zásoby, which shows
 * the same rows plus the ones that are fine, and can restock them.
 *
 * No `config` export, so it never appears in the sidebar.
 */
const Redirect = () => <Navigate to="/prehled/zasoby" replace />;

export default Redirect;
