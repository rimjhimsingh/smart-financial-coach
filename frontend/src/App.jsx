/**
 * App Router
 * ----------
 * This file defines the client side routing configuration for the React app.
 *
 * What it does:
 * - Creates a browser router with the application's route tree.
 * - Uses AppLayout as the shared shell for all pages (navigation, shared layout).
 * - Wires an errorElement so unexpected routing or rendering errors show a friendly UI.
 * - Registers the primary pages:
 *   - "/" renders the Dashboard page.
 *   - "/subscriptions" renders the Subscriptions page.
 * - Exports the App component that mounts the RouterProvider.
 */

import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Error from "./components/Error";
import Dashboard from "./pages/Dashboard";
import Subscriptions from "./pages/Subscriptions";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <Error />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "subscriptions", element: <Subscriptions /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
