import { test, expect } from "@playwright/test";
import { login, STAFF } from "./helpers";

test("desktop menu groups work by purpose and preserves old links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await login(page, STAFF);
  const sidebar = page.locator("aside").first();
  for (const name of [
    "Au quotidien",
    "Parcours & automatisations",
    "Pilotage",
    "Administration",
    "Aide",
  ]) {
    await expect(
      sidebar.getByRole("navigation", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(
    sidebar.getByRole("link", { name: "Copilote d’action" }),
  ).toHaveCount(0);
  await expect(
    sidebar.getByRole("link", { name: "File de validation" }),
  ).toHaveCount(0);
  await sidebar.getByRole("link", { name: "À traiter" }).click();
  for (const name of [
    "Documents à vérifier",
    "Assurances à suivre",
    "Réponses patients",
    "Demandes d’aide",
    "Validations en attente",
  ]) {
    await expect(
      page.getByRole("tab", { name: new RegExp(name) }),
    ).toBeVisible();
  }
  await page.getByRole("tab", { name: /Documents à vérifier/ }).click();
  await expect(page).toHaveURL(/onglet=documents/);
  await page.getByRole("tab", { name: /Réponses patients/ }).click();
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: /Documents à vérifier/ }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goto("/validation");
  await expect(
    page.getByRole("tab", { name: "Validations en attente" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goto("/copilote");
  await expect(page).toHaveURL(/automatisations\?onglet=copilote/);
  await expect(
    page.getByRole("button", { name: "Voir les actions proposées" }),
  ).toBeVisible();
  await page.goto("/agents");
  await expect(
    page.getByRole("heading", { name: "Agents IA", exact: true }),
  ).toBeVisible();
  await page.goto("/resultats");
  await expect(
    page.getByRole("heading", { name: "Mesurer avant et après le pilote" }),
  ).toBeVisible();
  await page.goto("/operations");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByText("Clinique Atlas · Casablanca").first(),
  ).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/27-navigation-desktop.png",
    fullPage: false,
  });
});

test("mobile exposes five entries and closes Plus after navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, STAFF);
  const mobile = page.getByRole("navigation", {
    name: "Navigation équipe mobile",
  });
  await expect(mobile.getByRole("link")).toHaveCount(4);
  await expect(mobile.getByRole("button", { name: "Plus" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await mobile.getByRole("button", { name: "Plus" }).click();
  const more = page.getByRole("navigation", { name: "Autres rubriques" });
  await expect(
    more.getByRole("link", { name: "Bibliothèque de parcours" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/28-navigation-mobile.png",
    fullPage: false,
  });
  await more.getByRole("link", { name: "Bibliothèque de parcours" }).click();
  await expect(more).toHaveCount(0);
  await expect(page.getByText("9 modèles de référence")).toBeVisible();
});

test("dossier sections retain patient context and link to insurance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await login(page, STAFF);
  await page.goto("/parcours");
  await page.locator('a[href^="/parcours/"]').first().click();
  const url = page.url().split("?")[0];
  const nav = page.getByRole("navigation", { name: "Rubriques du dossier" });
  await nav.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Documents attendus" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chronologie du parcours" }),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "Historique" }).click();
  await expect(
    page.getByRole("heading", { name: "Activité récente" }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Assurance", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Dossier administratif" });
  await expect(
    dialog.getByRole("heading", { name: "Prises en charge et assurances" }),
  ).toBeInViewport();
  await dialog.getByRole("button", { name: "Finances", exact: true }).click();
  await expect(
    dialog.getByRole("heading", {
      name: "Suivi financier administratif · MAD",
    }),
  ).toBeInViewport();
  await dialog.getByRole("link", { name: "Résumé", exact: true }).click();
  await expect(page).toHaveURL(url + "?onglet=resume");
  await expect(
    page.getByRole("button", { name: "Assistant du dossier" }),
  ).toBeVisible();
});

test("coordinator lands on work and has no administration shortcuts", async ({
  page,
}) => {
  // UI role fixture: server authorization itself is covered by API security tests.
  await page.route("**/api/me", async (route) => {
    const response = await route.fetch();
    const me = await response.json();
    await route.fulfill({ response, json: { ...me, roles: ["coordinator"] } });
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await login(page, STAFF);
  await expect(page).toHaveURL(/\/operations$/);
  await expect(
    page.getByRole("heading", { name: "À traiter", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("aside")
      .getByRole("navigation", { name: "Administration", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Concepteur", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Mes dossiers et ceux sans responsable"),
  ).toBeChecked();
  await page.goto("/integrations");
  await expect(
    page.getByRole("heading", { name: "À traiter", exact: true }),
  ).toBeVisible();
});

test("overview and dossier screenshots reflect the new navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, STAFF);
  await page.evaluate(()=>localStorage.setItem("m3aya-display",JSON.stringify({hideTechnical:true})));
  await page.goto("/vue-ensemble");
  await expect(
    page.getByRole("button", { name: "Nouveau dossier", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Clinique Atlas · Casablanca").first(),
  ).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/01-cockpit.png",
    fullPage: false,
  });
  await page.screenshot({
    path: "../../docs/screenshots/01b-cockpit-full.png",
    fullPage: true,
  });
  await page.goto("/parcours");
  await page.locator('a[href^="/parcours/"]').first().click();
  await expect(
    page.getByRole("heading", { name: "Chronologie du parcours" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/02-journey-detail.png",
    fullPage: false,
  });
  for (const [url, heading, file] of [
    ["/validation", "File de validation", "03-validation-queue.png"],
    ["/concepteur", "Concepteur de parcours", "04-journey-designer.png"],
    ["/analyses", "Analyses", "05-analytics.png"],
    ["/parametres", "Paramètres", "10-compliance-settings.png"],
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    if (url === "/validation")
      await expect(
        page
          .getByRole("button", { name: "Approuver", exact: true })
          .first()
          .or(page.getByText("Aucune tâche en attente", { exact: true })),
      ).toBeVisible();
    await page.screenshot({
      path: "../../docs/screenshots/" + file,
      fullPage: false,
    });
  }
});
