import { expect, type Page } from "@playwright/test";

// Comptes de DÉMO du realm de dev (infrastructure/keycloak/carepilot-realm.json). Jamais de vrais comptes.
export const STAFF = { user: "staff.demo", password: process.env.E2E_STAFF_PASSWORD ?? "demo-only" };
export const PATIENT = { user: "patient.demo", password: process.env.E2E_PATIENT_PASSWORD ?? "demo-only" };

export async function login(page: Page, who: { user: string; password: string }) {
  await page.goto("/app");
  await page.locator("#username").fill(who.user);
  await page.locator("#password").fill(who.password);
  await page.locator("#kc-login").click();
  await expect(page.locator('button[aria-label="Déconnexion"], button[aria-label="Quitter"]').first()).toBeVisible();
}
