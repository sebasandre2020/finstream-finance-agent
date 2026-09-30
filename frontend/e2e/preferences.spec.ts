import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "test-user",
        name: "Test User",
        email: "test@example.test",
      },
    }),
  );
  await page.route("**/api/v1/auth/google/status", (route) =>
    route.fulfill({ json: { configured: true } }),
  );
  await page.route("**/api/v1/transactions?**", (route) =>
    route.fulfill({ json: { data: [], has_more: false, next_cursor: null } }),
  );
  await page.route("**/api/v1/stream/events", (route) => route.abort());
});

async function openDemo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a demo" }).click();
}

test("dark mode button toggles theme between bright and dark, persists and passes accessibility", async ({
  page,
}) => {
  await openDemo(page);

  // Initially in light mode
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
  ).toBe(false);

  // Toggle to dark mode
  const darkBtn = page.getByRole("button", { name: "Switch to dark mode" });
  await expect(darkBtn).toBeVisible();
  await darkBtn.click();

  // HTML has dark class
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
  ).toBe(true);

  // Button changes aria-label to switch to light mode
  const lightBtn = page.getByRole("button", { name: "Switch to light mode" });
  await expect(lightBtn).toBeVisible();

  // WCAG accessibility check in dark mode
  const darkResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    darkResults.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);

  // Persists across reload
  await page.reload();
  await page.getByRole("button", { name: "Explore a demo" }).click();
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
  ).toBe(true);

  // Toggle back to light mode
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
  ).toBe(false);
  await expect(
    page.getByRole("button", { name: "Switch to dark mode" }),
  ).toBeVisible();
});

test("language button toggles between English and Spanish, persists and passes accessibility", async ({
  page,
}) => {
  await openDemo(page);

  // Initially in English
  await expect(
    page.getByRole("navigation").getByRole("button", { name: "Overview" }),
  ).toBeVisible();
  await expect(page.getByText("Your monthly target")).toBeVisible();

  // Toggle to Spanish
  const toSpanishBtn = page.getByRole("button", {
    name: "Cambiar a Español",
  });
  await expect(toSpanishBtn).toBeVisible();
  await toSpanishBtn.click();

  // Navigation items and headers are in Spanish
  await expect(
    page.getByRole("navigation").getByRole("button", { name: "Resumen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("button", { name: "Actividad" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Plan de gastos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("button", { name: /Por revisar/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tu objetivo mensual" }),
  ).toBeVisible();
  await expect(
    page.getByText("Una vista más clara de tu dinero."),
  ).toBeVisible();

  // Document language attribute updated
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("es");

  // WCAG accessibility check in Spanish
  const esResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    esResults.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);

  // Switch to English button is visible
  const toEnglishBtn = page.getByRole("button", {
    name: "Switch to English",
  });
  await expect(toEnglishBtn).toBeVisible();

  // Persists across reload
  await page.reload();
  await page.getByRole("button", { name: "Explorar versión de prueba" }).click();
  await expect(
    page.getByRole("navigation").getByRole("button", { name: "Resumen" }),
  ).toBeVisible();

  // Toggle back to English
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("navigation").getByRole("button", { name: "Overview" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
});

test("auth screen allows switching language and dark mode", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401 }),
  );
  await page.goto("/");

  // Verify English auth screen
  await expect(page.getByText("Your money.")).toBeVisible();
  await expect(page.getByText("Your own space.")).toBeVisible();

  // Switch to Spanish on auth screen
  await page.getByRole("button", { name: "Cambiar a Español" }).click();
  await expect(page.getByText("Tu dinero.")).toBeVisible();
  await expect(page.getByText("Tu propio espacio.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Iniciar sesión con Google" }),
  ).toBeVisible();

  // Switch to dark mode on auth screen
  await page.getByRole("button", { name: "Cambiar a modo oscuro" }).click();
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
  ).toBe(true);

  // Switch back to light mode and English
  await page.getByRole("button", { name: "Cambiar a modo claro" }).click();
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
  ).toBe(false);

  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByText("Your money.")).toBeVisible();
});
