import React from "react";
import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import CopilotWidget from "./CopilotWidget";


export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <AppHeader />
        <main className="mt-6">
          <Outlet />
        </main>
        <CopilotWidget />

      </div>
    </div>
  );
}