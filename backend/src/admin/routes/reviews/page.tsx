import { Navigate } from "react-router-dom";

/**
 * Compatibility redirect. Recenze moved into Přehled — moderation is a work
 * queue like any other and belongs with the rest of the work, not in its own
 * corner of the sidebar.
 *
 * No `config` export, so it never appears as a duplicate entry.
 */
const ReviewsRedirect = () => <Navigate to="/prehled/recenze" replace />;

export default ReviewsRedirect;
