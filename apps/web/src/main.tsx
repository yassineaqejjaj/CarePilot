import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { initAuth, patientSession } from "@/auth";
import { ToastProvider } from "@/components/ui";

import "./index.css";

// Public marketing pages never initialize Keycloak or request patient data.
const publicPage = ["/", "/bienvenue"].includes(window.location.pathname);
if (publicPage) {
  import("@/pages/Landing").then(({ default: Landing }) =>
    createRoot(document.getElementById("root")!).render(<React.StrictMode><Landing /></React.StrictMode>));
} else {
  const patientMode = window.location.pathname.startsWith("/p/") || !!patientSession();
  (patientMode ? Promise.resolve(true) : initAuth()).then(async () => {
    const { default: App } = await import("@/App");
    createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } })}>
          <ToastProvider><BrowserRouter><App /></BrowserRouter></ToastProvider>
        </QueryClientProvider>
      </React.StrictMode>);
  });
}
