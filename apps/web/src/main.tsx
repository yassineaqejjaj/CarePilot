import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { initAuth, patientSession } from "@/auth";
import { ToastProvider } from "@/components/ui";
import App from "@/App";
import "./index.css";

// Lien patient (/p/…) ou session patient : pas de Keycloak. Le personnel passe par Keycloak (PKCE).
const patientMode = window.location.pathname.startsWith("/p/") || !!patientSession();
(patientMode ? Promise.resolve(true) : initAuth()).then(() =>
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } })}>
        <ToastProvider><BrowserRouter><App /></BrowserRouter></ToastProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  ),
);
