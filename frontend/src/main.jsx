/**
 * Frontend Entry Point
 * --------------------
 * This file is the main browser entry for the React application.
 *
 * What it does:
 * - Locates the root DOM node in index.html.
 * - Creates a React root using React 18's createRoot API.
 * - Renders the top level App component into the page.
 *
 * This module stays minimal by design so all routing, providers, and app level
 * configuration live inside App (or a dedicated providers file) rather than here.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element with id 'root' not found");
}

createRoot(rootEl).render(<App />);
