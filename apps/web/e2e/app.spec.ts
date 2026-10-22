import { expect, test } from "@playwright/test";
import { login, PATIENT, STAFF } from "./helpers";

test("un visiteur non connecté est redirigé vers Keycloak", async ({ page }) => {
  await page.goto("/parcours");
  await expect(page).toHaveURL(/\/realms\/carepilot\/protocol\/openid-connect\/auth/);
  await expect(page.locator("#kc-login")).toBeVisible();
});

test("cockpit : indicateurs, file prioritaire et assistant", async ({ page }) => {
  await login(page, STAFF);
  await expect(page.getByRole("heading", { name: /Bonjour Claire/ })).toBeVisible();
  await expect(page.getByText("Parcours actifs")).toBeVisible();
  await expect(page.getByRole("heading", { name: "File prioritaire" })).toBeVisible();
  await expect(page.getByLabel("CarePilot Assistant")).toContainText("uniquement les tâches administratives");
});

test("détail d'un parcours : chronologie, documents, suggestion IA à valider", async ({ page }) => {
  await login(page, STAFF);
  await page.getByRole("link", { name: "Parcours patients" }).first().click();
  await page.getByRole("link", { name: "Sophie Martin", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sophie Martin" })).toBeVisible();
  await expect(page.getByText("Chronologie du parcours")).toBeVisible();
  await expect(page.getByText("Documents attendus")).toBeVisible();
  await expect(page.getByText("Suggestion CarePilot · validation humaine requise")).toBeVisible();
});

test("validation humaine : la proposition est validée, l'envoi reste simulé", async ({ page }) => {
  await login(page, STAFF);
  await page.getByRole("link", { name: "File de validation" }).click();
  await expect(page.getByRole("heading", { name: "File de validation" })).toBeVisible();
  const approve = page.getByRole("button", { name: "Approuver", exact: true });
  await page.waitForTimeout(800); // laisse la liste se charger
  test.skip((await approve.count()) === 0, "file vide : réinitialiser la base de démo (RESET=1)");
  await approve.first().click();
  await expect(page.getByText("Proposition validée")).toBeVisible();
  await expect(page.getByText("l'envoi SMS / e-mail est simulé")).toBeVisible();
});

test("concepteur : un parcours publié est immuable, une nouvelle version est éditable", async ({ page }) => {
  await login(page, STAFF);
  await page.getByRole("link", { name: "Concepteur de parcours" }).click();
  const v1 = await page.getByLabel("Version").locator("option", { hasText: "— v1" }).textContent();
  await page.getByLabel("Version").selectOption({ label: v1! });
  await expect(page.getByText("Publié", { exact: true })).toBeVisible();
  await expect(page.getByText("Un parcours publié est immuable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publier" })).toHaveCount(0);
  await page.getByRole("button", { name: "Nouvelle version" }).click();
  await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Ajouter une étape" }).click();
  await expect(page.getByLabel("Titre")).toHaveValue("Nouvelle étape");
});

test("espace patient mobile : seulement son parcours, aucun accès au back-office", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, PATIENT);
  await expect(page.getByRole("heading", { name: /Bonjour Sophie/ })).toBeVisible();
  await expect(page.getByText("Pour toute question médicale")).toBeVisible();
  await expect(page.getByRole("link", { name: "File de validation" })).toHaveCount(0);
  await page.goto("/parcours");
  await expect(page).toHaveURL(/\/portal$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false); // pas de défilement horizontal sur mobile
});

test("le patient dépose sa pièce : confirmation affichée", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, PATIENT);
  await expect(page.getByText("Votre préparation")).toBeVisible();
  const cta = page.getByRole("button", { name: /Prendre une photo|Marquer comme complété/ });
  test.skip((await cta.count()) === 0, "plus de tâche à soumettre : réinitialiser la base de démo (RESET=1)");
  await cta.click();
  await expect(page.getByText("Merci, c'est envoyé")).toBeVisible();
});
