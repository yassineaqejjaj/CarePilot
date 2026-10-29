import { test, expect } from "@playwright/test";
import { login, STAFF } from "./helpers";

test("complete tour is replayable and never changes a dossier", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (
      r.url().includes("/api/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(r.method())
    )
      mutations.push(r.url().split("/api/")[1]);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, STAFF);
  const invite = page.getByLabel("Découvrir M3aya Santé");
  await expect(invite).toBeVisible();
  await invite.getByRole("link", { name: "Commencer la visite" }).click();
  await expect(invite).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Un parcours complet, pas à pas." }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Étapes de la visite").getByRole("button"),
  ).toHaveCount(13);
  await page
    .locator(".tour")
    .evaluate((el) =>
      Promise.all(
        el
          .getAnimations({ subtree: true })
          .map((a) => a.finished.catch(() => {})),
      ),
    );
  await page.screenshot({
    path: "../../docs/screenshots/30-onboarding-desktop.png",
    fullPage: false,
  });
  for (let i = 1; i < 13; i++) {
    await expect(
      page.getByRole("status").filter({ hasText: `Étape ${i} sur 13` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Suivant", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Vous avez fait le tour du parcours." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Quitter la visite" }).click();
  await expect(invite).toHaveCount(0);
  await page
    .locator("aside")
    .first()
    .getByRole("navigation", { name: "Aide", exact: true })
    .getByRole("link", { name: "Visite guidée", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Accompagnez Amal, du premier contact au suivi.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reprendre à l’étape 13" }).click();
  await expect(
    page.getByRole("heading", { name: "Vous avez fait le tour du parcours." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recommencer", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Étape 1 sur 13" }),
  ).toBeVisible();
  expect(mutations).toEqual([]);
});

test("autoplay pauses, responds to Escape and preserves progress", async ({
  page,
}) => {
  await login(page, STAFF);
  await page.goto("/visite-guidee");
  await expect(
    page.getByRole("heading", { name: "Un parcours complet, pas à pas." }),
  ).toBeVisible();
  await page.clock.install();
  await page
    .getByRole("button", { name: "Lecture automatique", exact: true })
    .click();
  await page.clock.fastForward(8000);
  await expect(
    page.getByRole("status").filter({ hasText: "Étape 2 sur 13" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Lecture automatique", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.clock.fastForward(16000);
  await expect(
    page.getByRole("status").filter({ hasText: "Étape 2 sur 13" }),
  ).toBeVisible();
  await page.goto("/visite-guidee");
  await page.getByRole("button", { name: "Reprendre à l’étape 2" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Étape 2 sur 13" }),
  ).toBeVisible();
});

test("tour is readable on mobile and honors reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page, STAFF);
  await page.goto("/visite-guidee");
  await expect(
    page.getByRole("button", { name: "Lecture automatique", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".tour-scene")).toHaveCSS("animation-name", "none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Étape 2 sur 13" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/31-onboarding-mobile.png",
    fullPage: false,
  });
});

test("first-use invitation can be dismissed without hiding replay access", async ({
  page,
}) => {
  await login(page, STAFF);
  await page
    .getByLabel("Découvrir M3aya Santé")
    .getByRole("button", { name: "Plus tard" })
    .click();
  await page.reload();
  await expect(page.getByLabel("Découvrir M3aya Santé")).toHaveCount(0);
  await page
    .locator("header")
    .getByRole("link", { name: "Visite guidée", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Un parcours complet, pas à pas." }),
  ).toBeVisible();
});
