import { mkdir } from "node:fs/promises";
import { test, expect } from "./audit-fixtures";

// Run against the isolated release candidate, with the actual backend flag off.
test.skip(process.env.E2E_AUDIT !== "1", "Requires the isolated audit server");
const artifactRoot = "artifacts/design-integration/release";

for (const theme of ["light", "dark"] as const) {
  for (const [role, button, heading] of [
    ["tutor", "Я преподаватель", "Хороший день, чтобы учить."],
    ["learner", "Я ученик", "Ваш следующий шаг."],
    ["guardian", "Я родитель", "Кабинет родителя"],
  ] as const) {
    test(`release design: ${role} passwordless demo, labelled data and reload in ${theme}`, async ({ page, request }) => {
      const config = await request.get("/api/config");
      expect(config.ok()).toBe(true);
      expect((await config.json()).learning_journey_enabled).toBe(false);
      await page.setViewportSize({ width: 320, height: 844 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/");
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.getByText(/ДЕМО · СИНТЕТИЧЕСКИЕ ДАННЫЕ/)).toBeVisible();
      await expect(page.getByLabel("Как к вам обращаться")).toHaveCount(0);
      if (role !== "guardian") {
        await expect(page.locator(".assignment-row")).toHaveCount(role === "tutor" ? 2 : 1);
        // scrollWidth alone misses a button squeezed into one letter per line.
        const logout = page.getByRole("button", { name: "Выйти", exact: true });
        await expect(logout).toBeVisible();
        const geometry = await logout.evaluate((button) => {
          const text = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes("Выйти"))!;
          const range = document.createRange();
          range.selectNodeContents(text);
          const labelLines = [...range.getClientRects()].filter((rect) => rect.width > 0).length;
          const box = button.getBoundingClientRect();
          const bar = button.closest(".topbar")!.getBoundingClientRect();
          return { labelLines, inside: box.top >= bar.top && box.bottom <= bar.bottom && box.left >= bar.left && box.right <= bar.right };
        });
        expect(geometry).toEqual({ labelLines: 1, inside: true });
      }
      await expect(page.getByRole("heading", { name: "Мой путь", exact: true })).toHaveCount(0);
      await expect(page.locator(".streak-card, .submission-moment")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await mkdir(artifactRoot, { recursive: true });
      await page.screenshot({ path: `${artifactRoot}/320-${theme}-${role}.png`, fullPage: true });
      await page.reload();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.getByLabel("Как к вам обращаться")).toHaveCount(0);
      await expect(page.getByText(/ДЕМО · СИНТЕТИЧЕСКИЕ ДАННЫЕ/)).toBeVisible();
    });
  }
}
