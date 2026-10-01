import { test } from "@playwright/test";
import path from "path";

const outDir = path.resolve(process.cwd(), "../docs/assets/screenshots");

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "demo-user",
        name: "Alex Morgan",
        email: "alex.morgan@example.com",
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

test("capture high-resolution screenshots of all features", async ({
  page,
}) => {
  // Set nice crisp 1440x900 viewport with deviceScaleFactor: 2 for sharp rendering
  await page.setViewportSize({ width: 1440, height: 960 });

  // 1. Auth / Sign-in Screen (signed out)
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401 }),
  );
  await page.goto("/");
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, "01-auth-google-signin.png"),
    fullPage: false,
  });

  // Re-enable signed in / demo state
  await page.getByRole("button", { name: "Explore a demo" }).click();
  await page.waitForTimeout(400);

  // Set a sample spending target so the target card looks active and informative
  await page.getByRole("button", { name: "Set a spending target" }).click();
  await page.getByLabel("Monthly target (USD)").fill("2500");
  await page.getByRole("button", { name: "Save target" }).click();
  await page.waitForTimeout(300);

  // 2. Overview Dashboard (Light Mode)
  await page.screenshot({
    path: path.join(outDir, "02-overview-dashboard.png"),
    fullPage: false,
  });

  // 3. Activity Feed & Filters
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Activity" })
    .click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "03-activity-feed-and-filters.png"),
    fullPage: false,
  });

  // 4. Transaction Details Modal
  await page.getByRole("button", { name: /Whole Foods Market/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "04-transaction-details-modal.png"),
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // 5. Spending Plan View
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Spending plan" })
    .click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "05-spending-plan.png"),
    fullPage: false,
  });

  // 6. Spending Target Modal
  await page.getByRole("button", { name: "Edit spending target" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "06-spending-target-modal.png"),
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // 7. To Review View (Anomalies)
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /To review/ })
    .click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "07-to-review-anomalies.png"),
    fullPage: false,
  });

  // 8. Help / "How it works" Modal
  await page.getByRole("button", { name: "How it works" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "08-help-how-it-works-modal.png"),
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Return to Overview
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Overview" })
    .click();
  await page.waitForTimeout(300);

  // 9. Dark Mode Overview
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, "09-dark-mode-overview.png"),
    fullPage: false,
  });

  // 10. Dark Mode Activity
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Activity" })
    .click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "10-dark-mode-activity.png"),
    fullPage: false,
  });

  // Switch back to light mode for Spanish screenshot
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.waitForTimeout(300);

  // 11. Spanish Mode Overview
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Overview" })
    .click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Cambiar a Español" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, "11-spanish-overview.png"),
    fullPage: false,
  });

  // Switch language back to English for consistency
  await page.getByRole("button", { name: "Switch to English" }).click();
  await page.waitForTimeout(300);

  // 12. Mobile Responsive View
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, "12-mobile-responsive-overview.png"),
    fullPage: false,
  });
});
