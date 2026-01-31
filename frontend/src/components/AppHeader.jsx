import React from "react";
import { Link, useLocation } from "react-router-dom";

function NavLink({ to, children }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={
        "rounded-lg px-3 py-2 text-sm font-semibold transition " +
        (active
          ? "bg-slate-800 text-slate-100"
          : "text-slate-300 hover:bg-slate-900 hover:text-slate-100")
      }
    >
      {children}
    </Link>
  );
}

export default function AppHeader() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400" />
        <div>
          <div className="text-lg font-extrabold tracking-tight">Smart Financial Coach</div>
          <div className="text-xs text-slate-400">Executive overview and savings insights</div>
        </div>
      </div>

      <nav className="flex items-center gap-2">
        <NavLink to="/">Dashboard</NavLink>
      </nav>
    </header>
  );
}
