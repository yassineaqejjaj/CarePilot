import { test, expect, type Page } from "@playwright/test";
import { login, STAFF } from "./helpers";
async function staff(page: Page) {
  let token = "";
  page.on("request", (r) => {
    if (r.url().includes("/api/")) {
      const t = r.headers()["authorization"];
      if (t) token = t;
    }
  });
  await login(page, STAFF);
  return async (path: string, body?: unknown) => {
    const r = await page.request[body === undefined ? "get" : "post"](
      "/api" + path,
      {
        headers: { Authorization: token },
        ...(body === undefined ? {} : { data: body }),
      },
    );
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
}
async function example(call: (path: string, body?: unknown) => Promise<any>) {
  const templates = await call("/templates");
  const t = templates.find(
    (t: any) =>
      t.status === "published" && t.name.startsWith("Chirurgie ambulatoire"),
  );
  return await call("/journeys", {
    patient: {
      first_name: "Pilote",
      last_name: "Fictif " + Date.now(),
      birth_date: "14/03/1986",
      phone: "",
      email: "pilot@example.com",
      informed: true,
    },
    template_id: t.id,
    surgery_date: "2026-11-20",
    procedure: "Exemple de coordination administrative",
  });
}

test("staff can prepare insurance and an exact MAD estimate on a fictitious dossier", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const call = await staff(page);
  const j = await example(call);
  await page.goto("/operations?section=assurance&dossier=" + j.id);
  const dialog = page.getByRole("dialog", { name: "Dossier administratif" });
  await expect(
    dialog.getByRole("heading", { name: /dossier administratif/ }),
  ).toBeVisible();
  await dialog
    .getByLabel("Organisme", { exact: true })
    .fill("Assurance fictive");
  await dialog.getByLabel("Référence de la demande").fill("PEC-DEMO");
  await dialog.getByRole("button", { name: "Préparer une demande" }).click();
  await expect(
    dialog.getByText("Assurance fictive", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmer l’état reçu" }).click();
  await expect(dialog.getByText("Transmis", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Finances", exact: true }).click();
  await dialog.getByLabel("Montant en MAD").fill("1000.01");
  await dialog.getByLabel("Référence du justificatif").fill("DEVIS-DEMO");
  await dialog.getByText("J’ai vérifié le justificatif.").click();
  await dialog.getByRole("button", { name: "Enregistrer l’écriture" }).click();
  await expect(
    dialog.locator("li").filter({ hasText: "DEVIS-DEMO" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/26-administrative-case.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.goto("/resultats");
  await expect(
    page.getByRole("heading", { name: "Mesurer avant et après le pilote" }),
  ).toBeVisible();
});

test("preparation worklist and rollout setup are accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await staff(page);
  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "À traiter", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/25-preparation-center.png",
    fullPage: false,
  });
  await page.goto("/demarrage");
  await expect(
    page.getByRole("heading", { name: "Préparer le premier pilote" }),
  ).toBeVisible();
  await page.goto("/operations?onglet=reseau");
  await expect(
    page.getByRole("heading", { name: "Vos établissements autorisés" }),
  ).toBeVisible();
});

test("new journey saves an encrypted draft and resumes without creating a patient", async ({
  page,
}) => {
  await staff(page);
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Nouveau dossier", exact: true })
    .click();
  await page.getByLabel("Prénom", { exact: true }).fill("Brouillon fictif");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Brouillon chiffré enregistré." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page
    .getByRole("button", { name: "Nouveau dossier", exact: true })
    .click();
  await expect(page.getByLabel("Prénom", { exact: true })).toHaveValue(
    "Brouillon fictif",
  );
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
});

test("patient can ask for help and grant then revoke a limited companion session", async ({
  page,
  browser,
}) => {
  const call = await staff(page);
  const j = await example(call);
  const setup = await call("/operations/worklist");
  test.skip(
    setup.messaging_provider !== "console",
    "Only synthetic console transport is allowed in this scenario",
  );
  const invite = await call("/journeys/" + j.id + "/invite", {});
  const patientContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const p = await patientContext.newPage();
  await p.goto(invite.link);
  await p.getByLabel("Date de naissance (JJ/MM/AAAA)").fill("14/03/1986");
  await p.getByRole("button", { name: "Continuer" }).click();
  await p.getByRole("button", { name: /j'accepte/i }).click();
  await p
    .getByText("J’ai besoin d’aide / écrire à mon équipe", { exact: true })
    .click();
  await p
    .getByLabel("Votre message administratif, sans information médicale")
    .fill("Je souhaite être aidé pour mes documents.");
  await p.getByRole("button", { name: "Transmettre à mon équipe" }).click();
  await expect(
    p.getByRole("status").filter({ hasText: "Votre demande est enregistrée." }),
  ).toBeVisible();
  await p
    .getByText("Un proche m’aide dans mes démarches", { exact: true })
    .click();
  await p.getByLabel("Nom de mon accompagnant").fill("Proche fictif");
  await p.getByLabel(/^J’autorise cette personne/).check();
  let grant: any;
  const response = p.waitForResponse(
    (r) =>
      r.url().endsWith("/operations/portal/delegations") &&
      r.request().method() === "POST",
  );
  await p.getByRole("button", { name: "Créer cet accès limité" }).click();
  grant = await (await response).json();
  const companionContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const c = await companionContext.newPage();
  await c.goto(grant.link);
  await c.getByLabel("Code à 6 chiffres").fill(grant.code);
  await c.getByRole("button", { name: "Ouvrir mon accès" }).click();
  await expect(c.getByText("Espace accompagnant · accès limité")).toBeVisible();
  await expect(c.getByText("Un proche m’aide dans mes démarches")).toHaveCount(
    0,
  );
  await expect(
    c.getByRole("button", { name: "Mes droits", exact: true }),
  ).toHaveCount(0);
  await p.getByRole("button", { name: "Masquer", exact: true }).click();
  await p.getByRole("button", { name: "Révoquer cet accès" }).click();
  await c.reload();
  await expect(
    c.getByRole("button", { name: "Retour au site", exact: true }),
  ).toBeVisible();
  await expect(c.getByText("Espace accompagnant · accès limité")).toHaveCount(
    0,
  );
  await patientContext.close();
  await companionContext.close();
});
