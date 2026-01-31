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
