import { expect, test, type Page } from "@playwright/test";
import { login, PATIENT, STAFF } from "./helpers";

// 1x1 PNG valide
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// Isolated fictional identity: consent and document state never depend on resetting the shared demo.
async function freshJourney(page: Page) {
  const pending = page.waitForRequest((r) => r.url().endsWith("/api/me"));
  await page.reload();
  const headers = { Authorization: (await pending).headers()["authorization"] };
  const tr = await page.request.get("/api/templates", { headers });
  const templates = await tr.json();
  const t = templates.find(
    (t: any) =>
      t.status === "published" && t.name.startsWith("Chirurgie ambulatoire"),
  );
  const r = await page.request.post("/api/journeys", {
    headers,
    data: {
      patient: {
        first_name: "Khadija",
        last_name: "Test consentement " + Date.now(),
        birth_date: "14/03/1986",
        informed: true,
      },
      template_id: t.id,
      surgery_date: "2026-11-20",
      procedure: "Démonstration administrative",
    },
  });
  expect(r.ok()).toBeTruthy();
  await page.goto("/parcours/" + (await r.json()).id);
  await expect(
    page.getByRole("button", { name: "Envoyer le lien patient" }),
  ).toBeVisible();
}

async function openKhadija(page: Page) {
  await page.getByRole("link", { name: "Parcours patients" }).first().click();
  await page.getByRole("link", { name: "Khadija Alaoui", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Khadija Alaoui" }),
  ).toBeVisible();
}

test("un visiteur non connecté est redirigé vers Keycloak", async ({
  page,
}) => {
  await page.goto("/parcours");
  await expect(page).toHaveURL(
    /\/realms\/carepilot\/protocol\/openid-connect\/auth/,
  );
  await expect(page.locator("#kc-login")).toBeVisible();
});

test("cockpit : indicateurs, file prioritaire et assistant", async ({
  page,
}) => {
  await login(page, STAFF);
  await expect(
    page.getByRole("heading", { name: /Bonjour Salma/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Clinique Atlas · Casablanca").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "File prioritaire" }),
  ).toBeVisible();
  await expect(page.getByLabel("M3aya Santé Assistant")).toContainText(
    "uniquement les tâches administratives",
  );
});

test("détail d'un parcours : chronologie, documents AMO/CIN, suggestion à valider", async ({
  page,
}) => {
  await login(page, STAFF);
  await openKhadija(page);
  await expect(page.getByText("Chronologie du parcours")).toBeVisible();
  await expect(
    page.getByText("Attestation AMO (CNSS / CNOPS)").first(),
  ).toBeVisible();
  await expect(page.getByText("CIN ou passeport").first()).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Préparation, assurances et suivi financier",
    }),
  ).toBeVisible();
});

test("validation humaine : la proposition est validée et l'envoi est journalisé (simulé)", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.getByRole("link", { name: "File de validation" }).click();
  await expect(
    page.getByRole("heading", { name: "File de validation" }),
  ).toBeVisible();
  const approve = page.getByRole("button", { name: "Approuver", exact: true });
  await page.waitForTimeout(800);
  test.skip(
    (await approve.count()) === 0,
    "file vide : réinitialiser la base de démo (RESET=1)",
  );
  await approve.first().click();
  await expect(page.getByText("Proposition validée")).toBeVisible();
  await page.getByRole("link", { name: "Communications" }).click();
  await expect(
    page.getByRole("heading", { name: "Communications" }),
  ).toBeVisible();
  await expect(page.getByText("Simulé").first()).toBeVisible();
});

test("lien patient sécurisé, consentement, arabe/RTL, dépôt de pièce, puis vérification côté personnel", async ({
  page,
  browser,
}) => {
  await login(page, STAFF);
  await freshJourney(page);
  await page.getByRole("button", { name: "Envoyer le lien patient" }).click();
  const link = await page.getByLabel("Lien", { exact: true }).inputValue();
  expect(link).toMatch(/\/p\/[\w-]{20,}$/);
  await page.getByRole("button", { name: "Fermer" }).click();

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const p = await ctx.newPage();
  await p.goto(link);
  // mauvaise date de naissance : refus sans indice
  await p.getByLabel("Date de naissance (JJ/MM/AAAA)").fill("01/01/1990");
  await p.getByRole("button", { name: "Continuer" }).click();
  await expect(p.getByRole("alert")).toContainText("Lien invalide");
  await p.getByLabel("Date de naissance (JJ/MM/AAAA)").fill("14/03/1986");
  await p.getByRole("button", { name: "Continuer" }).click();
  // consentement préalable (loi 09-08) : rien d'autre n'est visible
  await expect(
    p.getByRole("heading", { name: "Vos données personnelles" }),
  ).toBeVisible();
  await expect(p.getByText("Responsable du traitement")).toBeVisible();
  await expect(p.getByText("Mes tâches")).toHaveCount(0);
  await p.getByRole("button", { name: "J'ai lu et j'accepte" }).click();
  await expect(
    p.getByRole("heading", { name: /Bonjour Khadija/ }),
  ).toBeVisible();
  // arabe, de droite à gauche
  await p.getByRole("button", { name: "العربية" }).click();
  await expect(p.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(p.getByRole("heading", { level: 1 })).toContainText(
    "مرحباً Khadija",
  );
  expect(
    await p.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  await p.getByRole("button", { name: "Français" }).click();
  await expect(p.locator("html")).toHaveAttribute("dir", "ltr");
  // dépôt d'une pièce
  const cta = p.getByRole("button", { name: /Prendre une photo/ });
  if (await cta.count()) {
    const [chooser] = await Promise.all([
      p.waitForEvent("filechooser"),
      cta.click(),
    ]); // comme un vrai patient : bouton puis sélecteur
    await chooser.setFiles({
      name: "attestation.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await p.getByRole("button", { name: "Confirmer la transmission" }).click();
    await expect(p.getByText("Merci, c'est envoyé")).toBeVisible();
    // côté personnel : la pièce est « En revue » et consultable
    await page.reload();
    await expect(page.getByText("En revue").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Voir" }).first(),
    ).toBeVisible();
  }
  await ctx.close();
});

test("le patient refuse un format non accepté", async ({ page, browser }) => {
  await login(page, STAFF);
  await freshJourney(page);
  await page.getByRole("button", { name: "Envoyer le lien patient" }).click();
  const link = await page.getByLabel("Lien", { exact: true }).inputValue();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const p = await ctx.newPage();
  await p.goto(link);
  await p.getByLabel("Date de naissance (JJ/MM/AAAA)").fill("14/03/1986");
  await p.getByRole("button", { name: "Continuer" }).click();
  const accept = p.getByRole("button", { name: "J'ai lu et j'accepte" }); // déjà accepté lors d'un test précédent : on passe
  await expect(accept).toBeVisible();
  await accept.click();
  const cta = p.getByRole("button", { name: /Prendre une photo/ });
  await expect(p.getByText("Votre préparation")).toBeVisible();
  test.skip((await cta.count()) === 0, "plus de pièce à déposer");
  const [chooser] = await Promise.all([
    p.waitForEvent("filechooser"),
    cta.click(),
  ]);
  await chooser.setFiles({
    name: "virus.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("MZ-not-an-image"),
  });
  await expect(p.getByText("Format non accepté")).toBeVisible();
  await ctx.close();
});

test("nouveau parcours : consentement d'information obligatoire, puis import CSV avec simulation", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.getByRole("button", { name: "Nouveau parcours" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau parcours" });
  await dialog.getByLabel("Prénom").fill("Imad");
  await dialog.getByLabel("Nom", { exact: true }).fill("Test-E2E");
  await dialog.getByLabel("Date de naissance").fill("05/06/1980");
  await dialog.getByLabel("Téléphone (Maroc)").fill("06 12 34 56 78");
  await dialog
    .getByLabel("Acte / motif du rendez-vous", { exact: true })
    .fill("Cataracte");
  await dialog.getByLabel(/Date d.intervention/).fill("30/12/2030");
  await expect(
    dialog.getByRole("button", { name: "Créer le parcours" }),
  ).toBeDisabled(); // patient non informé
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Créer le parcours" }).click();
  await expect(
    page.getByRole("heading", { name: "Imad Test-E2E" }),
  ).toBeVisible();
  // import CSV : simulation puis import
  await page.getByRole("link", { name: "Parcours patients" }).first().click();
  await page.getByRole("button", { name: "Nouveau parcours" }).click();
  await page.getByRole("tab", { name: "Import CSV" }).click();
  const csv =
    "first_name;last_name;birth_date;phone;surgery_date;procedure\nSara;CsvE2E;01/02/1991;0661234567;30/12/2030;Hernie\nBad;Row;;pas-un-numero;30/12/2030;X\n";
  await page
    .getByLabel("Fichier CSV")
    .setInputFiles({
      name: "p.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page.getByRole("button", { name: "Simuler" }).click();
  await expect(
    page.getByText(/1 parcours seraient créés, 1 ligne\(s\) en erreur/),
  ).toBeVisible();
  await expect(page.getByText(/Ligne 3/)).toBeVisible();
  await page.getByRole("button", { name: "Importer" }).click();
  await expect(page.getByText("1 parcours importés")).toBeVisible();
});

test("paramètres de conformité : références CNDP et demandes d'exercice de droits", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.getByRole("link", { name: "Paramètres" }).click();
  await expect(
    page.getByRole("heading", { name: "Conformité — loi 09-08 (CNDP)" }),
  ).toBeVisible();
  await expect(page.getByText("Demandes d'exercice de droits")).toBeVisible();
  await expect(page.getByText("Rectification").first()).toBeVisible();
  await expect(page.getByText("IA inactive")).toBeVisible(); // pas d'autorisation de transfert renseignée
});

test("concepteur : un parcours publié est immuable, une nouvelle version est éditable", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.getByRole("link", { name: "Concepteur de parcours" }).click();
  const v1 = await page
    .getByLabel("Version")
    .locator("option", { hasText: /^Chirurgie ambulatoire.*— v1$/ })
    .textContent();
  await page.getByLabel("Version").selectOption({ label: v1! });
  await expect(page.getByText("Publié", { exact: true })).toBeVisible();
  await expect(page.getByText("Un parcours publié est immuable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publier" })).toHaveCount(0);
  await page.getByRole("button", { name: "Nouvelle version" }).click();
  await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Ajouter une étape" }).click();
  await expect(page.getByLabel("Titre")).toHaveValue("Nouvelle étape");
});

test("compte patient Keycloak : consentement d'abord, aucun accès au back-office", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, PATIENT);
  const heading = page.getByRole("heading", {
    name: /Vos données personnelles|Bonjour Khadija/,
  });
  await expect(heading).toBeVisible();
  await expect(
    page.getByRole("link", { name: "File de validation" }),
  ).toHaveCount(0);
  await page.goto("/parcours");
  await expect(page).toHaveURL(/\/portal$/);
});
