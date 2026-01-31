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
