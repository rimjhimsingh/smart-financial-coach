/**
 * Route Error Boundary
 * --------------------
 * This module renders a fallback UI when a route loader, action, or component throws within the
 * React Router tree.
 *
 * What it does:
 * - Uses useRouteError to retrieve the error associated with the failed route.
 * - Displays a simple, developer friendly message with the error content for debugging.
 * - Keeps the component minimal so routing errors do not break the rest of the app shell.
 */

import React from "react";
import { useRouteError } from "react-router-dom";

export default function Error() {
  const err = useRouteError();
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>Something went wrong</div>
      <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{String(err?.message || err)}</pre>
    </div>
  );
}
