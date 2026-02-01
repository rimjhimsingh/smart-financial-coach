/**
 * Modal Component
 * ---------------
 * This module provides a reusable modal dialog used to display focused content on top of the app.
 *
 * What it does:
 * - Conditionally renders an overlay and centered dialog when open is true.
 * - Closes on Escape key press and when the user clicks the backdrop outside the dialog.
 * - Locks background scrolling while the modal is open and restores the previous overflow style on close.
 *
 * Props:
 * - open: Controls whether the modal is visible.
 * - title: Optional dialog title displayed in the header.
 * - onClose: Callback invoked when the modal requests to close.
 * - children: Modal body content.
 */
import { useEffect } from "react";

export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="text-sm font-bold text-slate-100">{title || "Details"}</div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}
