import { test, expect } from "@playwright/test";
import { login, STAFF } from "./helpers";

test("saved views preserve workflow settings without persisting patient search", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.goto("/operations");
  await page.getByRole("tab",{name:/Assurances à suivre/}).click();
  await page
    .getByLabel("Rechercher un dossier", { exact: true })
    .fill("Recherche confidentielle");
  await page.getByLabel("Période de la liste").selectOption("tomorrow");
  await page.getByLabel("Trier la liste").selectOption("patient");
  await page.getByRole("button", { name: "Enregistrer cette vue" }).click();
  const stored = await page.evaluate(() =>
    Object.entries(localStorage).filter(([key]) =>
      key.startsWith("m3aya-views:"),
    ),
  );
  expect(JSON.stringify(stored)).not.toContain("Recherche confidentielle");
  await page.goto("/operations");
  await page.getByLabel("Vues de travail").selectOption("saved-0");
  await expect(
    page.getByRole("tab", { name: /Assurances à suivre/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Période de la liste")).toHaveValue("tomorrow");
  await expect(page.getByLabel("Trier la liste")).toHaveValue("patient");
  await expect(
    page.getByLabel("Rechercher un dossier", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Effacer les filtres", exact: true })
    .click();
  await expect(page.getByLabel("Période de la liste")).toHaveValue("all");
  await expect(page.getByLabel("Trier la liste")).toHaveValue("due");
  await page.getByRole("button", { name: "Effacer mes vues" }).click();
  await expect(
    page.getByLabel("Vues de travail").locator('option[value^="saved-"]'),
  ).toHaveCount(0);
});

test("received-document action opens the relevant dossier documents", async ({
  page,
}) => {
  let id = "";
  await page.route("**/api/operations/worklist", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const first = data.items[0];
    id = first.id;
    await route.fulfill({
      response,
      json: {
        ...data,
        items: [
          {
            ...first,
            help_pending: 0,
            profile_pending: 0,
            unread: 0,
            submitted: 2,
            insurance_pending: 0,
            assigned_subject: "",
          },
        ],
      },
    });
  });
  await login(page, STAFF);
  await page.goto("/operations");
  await page
    .getByRole("button", { name: "Vérifier les pièces", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/parcours/${id}\\?onglet=documents$`),
  );
  await expect(
    page.getByRole("heading", { name: "Documents attendus" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chronologie du parcours" }),
  ).toHaveCount(0);
});

test("dossier panel isolates finance from insurance and keeps history accessible", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.goto("/parcours");
  await page.locator('a[href^="/parcours/"]').first().click();
  await page
    .getByRole("navigation", { name: "Rubriques du dossier" })
    .getByRole("link", { name: "Assurance", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Dossier administratif" });
  await expect(dialog.getByLabel("Organisme", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Montant en MAD")).toBeHidden();
  await dialog.getByRole("button", { name: "Finances", exact: true }).click();
  await expect(dialog.getByLabel("Montant en MAD")).toBeVisible();
  await expect(dialog.getByLabel("Organisme", { exact: true })).toBeHidden();
  await dialog.getByRole("button", { name: "Historique", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Transmissions et historique" }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Montant en MAD")).toBeHidden();
  await dialog.getByRole("button").last().focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Fermer le dossier" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("display preferences persist and presentation mode never deletes dossiers", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.getByText("Affichage", { exact: true }).click();
  await page.getByLabel("Densité compacte").check();
  await page.getByLabel("Réduire le menu").check();
  await page.getByLabel("Masquer les tests techniques").check();
  await expect(page.locator('[data-density="compact"]')).toBeVisible();
  await expect(page.locator("aside").first()).toHaveCSS("width", "76px");
  await page.reload();
  await expect(page.locator('[data-density="compact"]')).toBeVisible();
  await expect(page.locator("aside").first()).toHaveCSS("width", "76px");
  await expect(
    page
      .locator("aside")
      .first()
      .getByRole("link", { name: "Dossiers patients", exact: true }),
  ).toBeVisible();
  await page.goto("/parcours");
  await expect(
    page.getByRole("heading", { name: "Dossiers patients" }),
  ).toBeVisible();
  await page.getByText("Affichage", { exact: true }).click();
  await page.getByLabel("Masquer les tests techniques").uncheck();
  await page.getByLabel("Réduire le menu").uncheck();
  await expect(page.locator("aside").first()).toHaveCSS("width", "248px");
});

test("mobile uses a reachable bottom dock and readable dossier cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, STAFF);
  await page.evaluate(() =>
    localStorage.setItem(
      "m3aya-display",
      JSON.stringify({ hideTechnical: true }),
    ),
  );
  await page.goto("/operations");
  const dock = page.getByRole("navigation", {
    name: "Navigation équipe mobile",
  });
  await expect(dock).toBeInViewport();
  const box = await dock.boundingBox();
  expect(box!.y).toBeGreaterThan(700);
  await expect(page.getByRole("table")).toBeHidden();
  await expect(page.getByLabel("Dossiers à traiter sur mobile")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "../../docs/screenshots/29-worklist-mobile.png",
    fullPage: false,
  });
});

test("dashboard gives three primary metrics and optional secondary detail", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.goto("/vue-ensemble");
  const metrics = page.getByLabel("Indicateurs prioritaires");
  await expect(
    metrics.getByText("Tâches dues ou en retard", { exact: true }),
  ).toBeVisible();
  await expect(
    metrics.getByText("Dossiers incomplets", { exact: true }),
  ).toBeVisible();
  await expect(
    metrics.getByText("Échéances d’ici trois jours", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Dossiers actifs", { exact: true })).toBeHidden();
  await page
    .getByText("Autres indicateurs de l’établissement", { exact: true })
    .click();
  await expect(
    page.getByText("Dossiers actifs", { exact: true }),
  ).toBeVisible();
});

test("optional dossier columns can be hidden and restored across reloads", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.goto("/parcours");
  await page.getByText("Colonnes", { exact: true }).click();
  await page.getByLabel("Responsable", { exact: true }).uncheck();
  await expect(
    page.getByRole("columnheader", { name: "Responsable", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("columnheader", { name: "Patient", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Responsable", exact: true }),
  ).toHaveCount(0);
  await page.getByText("Colonnes", { exact: true }).click();
  await page.getByLabel("Responsable", { exact: true }).check();
  await expect(
    page.getByRole("columnheader", { name: "Responsable", exact: true }),
  ).toBeVisible();
});
