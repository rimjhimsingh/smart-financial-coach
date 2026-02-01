/**
 * App Layout
 * ----------
 * This module defines the shared application layout used by the router for all pages.
 *
 * What it renders:
 * - AppHeader as the persistent top navigation and branding bar.
 * - Outlet as the nested route placeholder where page components render.
 * - CopilotWidget as a persistent assistant panel available across pages.
 *
 * Layout responsibilities:
 * - Applies the global background and text theme.
 * - Centers the content container and provides consistent spacing between header, page content,
 *   and the copilot widget.
 */

import React from "react";
import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import CopilotWidget from "./CopilotWidget";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <AppHeader />
        <main className="mt-6">
          <Outlet />
        </main>
        <CopilotWidget />
      </div>
    </div>
  );
}
