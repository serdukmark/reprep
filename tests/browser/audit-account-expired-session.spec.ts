import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";

const personas = [
  ["tutor", "Я преподаватель", "Алекс • демо"],
  ["learner", "Я ученик", "Саша • демо"],
  ["guardian", "Я родитель", "Родитель • демо"],
  ["outsider", "Другой преподаватель · демо", "Другой репетитор • демо"],
] as const;

for (const [role, button, alias] of personas)
  for (const action of ["request", "cancel"])
    test(`account deletion ${role} ${action}: revoked session refuses mutation and fresh login recovers`, async ({
      page,
      browser,
    }) => {
      const revoker = await browser.newPage(),
        observer = await browser.newPage();
      const settings = async (p: Page) => {
        if (role !== "guardian")
          await p.getByRole("button", { name: new RegExp(alias) }).click();
        await expect(
          p.getByRole("heading", { name: "Мои данные", exact: true }),
        ).toBeVisible();
      };
      const login = async (p: Page) => {
        await p.goto("/");
        await p.getByRole("button", { name: button, exact: true }).click();
        await settings(p);
      };
      const pending = (p: Page) =>
        p.getByText("Запрос на удаление ожидает обработки владельцем.", {
          exact: true,
        });
      try {
        await login(page);
        await page.getByLabel("Имя для запроса удаления").fill(alias);
        if (action === "cancel") {
          await page
            .getByRole("button", {
              name: "Запросить удаление аккаунта",
              exact: true,
            })
            .click();
          await expect(pending(page)).toBeVisible();
        }
        // An actual UI logout from another page sharing this synthetic token
        // revokes it on the server. No fake 401 and no direct logout API call.
        const token = await page.evaluate(() =>
          sessionStorage.getItem("reprep.session"),
        );
        expect(Boolean(token)).toBe(true);
        await revoker.addInitScript(
          (t) => sessionStorage.setItem("reprep.session", t!),
          token,
        );
        await revoker.goto("/");
        await settings(revoker);
        await revoker
          .getByRole("button", { name: "Выйти", exact: true })
          .click();
        await expect(
          revoker.getByRole("button", { name: button, exact: true }),
        ).toBeVisible();
        const endpoint =
          action === "request"
            ? "/api/account/deletion"
            : "/api/account/deletion/cancel";
        const refused = page.waitForResponse(
          (r) => r.url().endsWith(endpoint) && r.request().method() === "POST",
        );
        const command =
          action === "request"
            ? "Запросить удаление аккаунта"
            : "Отменить запрос на удаление";
        await page.getByRole("button", { name: command, exact: true }).click();
        expect((await refused).status()).toBe(401);
        await expect(page.getByRole("alert").first()).toBeVisible();
        if (action === "request") {
          await expect(page.getByLabel("Имя для запроса удаления")).toHaveValue(
            alias,
          );
          await expect(pending(page)).toHaveCount(0);
        } else {
          await expect(pending(page)).toBeVisible();
          await expect(
            page.getByText("Запрос отменён", { exact: true }),
          ).toHaveCount(0);
        }
        await login(observer);
        if (action === "request")
          await expect(
            observer.getByLabel("Имя для запроса удаления"),
          ).toBeVisible();
        else await expect(pending(observer)).toBeVisible();
        await page.reload();
        await page.getByRole("button", { name: button, exact: true }).click();
        await settings(page);
        if (action === "request")
          await page.getByLabel("Имя для запроса удаления").fill(alias);
        await page.getByRole("button", { name: command, exact: true }).click();
        if (action === "request") await expect(pending(page)).toBeVisible();
        else
          await expect(
            page.getByText("Запрос отменён", { exact: true }),
          ).toBeVisible();
        await page.reload();
        await settings(page);
        if (action === "request") await expect(pending(page)).toBeVisible();
        else
          await expect(
            page.getByLabel("Имя для запроса удаления"),
          ).toBeVisible();
      } finally {
        await revoker.close();
        await observer.close();
      }
    });
