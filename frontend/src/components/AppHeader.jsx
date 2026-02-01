import React from "react";
import { Link, useLocation } from "react-router-dom";

function LogoMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 shadow-lg shadow-indigo-500/20">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.5 12.5a2.5 2.5 0 015 0V15a2 2 0 01-2 2h-1a2 2 0 01-2-2v-2.5z"
        />
      </svg>
    </div>
  );
}

function NavLink({ to, children }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={
        "rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500/30 " +
        (active
          ? "border-slate-700/60 bg-slate-900/60 text-white shadow-sm"
          : "border-slate-800/60 bg-slate-950/10 text-slate-300 hover:border-slate-700/60 hover:bg-slate-900/40 hover:text-white")
      }
    >
      {children}
    </Link>
  );
}

export default function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800/60 bg-slate-950/30 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <LogoMark />
        <div className="leading-tight">
          <div className="text-base font-extrabold tracking-tight text-white">
            Smart Financial Coach
          </div>
          <div className="text-xs text-slate-400">
            Own Your Wealth
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-2">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/subscriptions">Recurring</NavLink>
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            className="rounded-xl border border-slate-800/60 bg-slate-950/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-700/60 hover:bg-slate-900/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            Your Account
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            Resources
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
