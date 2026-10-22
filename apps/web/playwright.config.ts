import { defineConfig } from "@playwright/test";

// Prérequis : stack démarrée (Postgres, Keycloak, API, `vite`) et base seedée (apps/api/seed.py).
// E2E_BASE_URL par défaut http://localhost:5173. Utilise le Chrome installé (pas de téléchargement de navigateur).
export default defineConfig({
  testDir: "e2e",
  workers: 1, // les scénarios partagent la même base de démo
  retries: 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", channel: process.env.E2E_CHANNEL ?? "chrome", trace: "retain-on-failure" },
});
