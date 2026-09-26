import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";

async function selectPupil(page: Page) {
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  await expect(
    page.getByRole("heading", { name: "Доступ родителя", exact: true }),
  ).toBeVisible();
}

for (const operation of ["create", "revoke"])
  test(`guardian invite ${operation}: revoked tutor session cannot change access, fresh login recovers`, async ({
    page,
    browser,
  }) => {
    const revoker = await browser.newPage(),
      guardian = await browser.newPage();
    const create = () =>
      page.getByRole("button", {
        name: "Создать приглашение родителю",
        exact: true,
      });
    const revoke = () =>
      page.getByRole("button", {
        name: "Отозвать доступ родителя",
        exact: true,
      });
    const accept = async (code: string) => {
      await guardian.getByLabel("Код приглашения родителю").fill(code);
      await guardian
        .getByRole("button", { name: "Принять доступ", exact: true })
        .click();
      await expect(
        guardian.getByRole("button", { name: /Саша • демо/ }),
      ).toHaveCount(1);
    };
    try {
      await page.goto("/");
      await page
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
      await selectPupil(page);
      await guardian.goto("/");
      await guardian
        .getByRole("button", { name: "Я родитель", exact: true })
        .click();
      let originalCode = "";
      if (operation === "revoke") {
        await create().click();
        originalCode = await page
          .getByLabel("Код родителя", { exact: true })
          .inputValue();
        await accept(originalCode);
      }
      const token = await page.evaluate(() =>
        sessionStorage.getItem("reprep.session"),
      );
      expect(Boolean(token)).toBe(true);
      await revoker.addInitScript(
        (value) => sessionStorage.setItem("reprep.session", value!),
        token,
      );
      await revoker.goto("/");
      await revoker.getByRole("button", { name: /Алекс • демо/ }).click();
      await revoker.getByRole("button", { name: "Выйти", exact: true }).click();
      await expect(
        revoker.getByRole("button", { name: "Я преподаватель", exact: true }),
      ).toBeVisible();
      const denied = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          (operation === "create"
            ? r.url().endsWith("/api/relationships/demo-link/guardians")
            : /\/api\/guardian\/invitations\/[^/]+\/revoke$/.test(r.url())),
      );
      await (operation === "create" ? create() : revoke()).click();
      expect((await denied).status()).toBe(401);
      await expect(
        page.getByRole("alert").filter({ hasText: "Сессия завершилась" }),
      ).toBeVisible();
      if (operation === "create")
        await expect(
          page.getByLabel("Код родителя", { exact: true }),
        ).toHaveCount(0);
      else
        await expect(
          page.getByLabel("Код родителя", { exact: true }),
        ).toHaveValue(originalCode);
      await guardian.reload();
      await expect(
        guardian.getByRole("button", { name: /Саша • демо/ }),
      ).toHaveCount(operation === "create" ? 0 : 1);
      await page.reload();
      await page
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
      await selectPupil(page);
      await expect(revoke()).toHaveCount(operation === "create" ? 0 : 1);
      await (operation === "create" ? create() : revoke()).click();
      if (operation === "create")
        await accept(
          await page.getByLabel("Код родителя", { exact: true }).inputValue(),
        );
      else await expect(revoke()).toHaveCount(0);
      await page.reload();
      await selectPupil(page);
      await expect(revoke()).toHaveCount(operation === "create" ? 1 : 0);
      await guardian.reload();
      await expect(
        guardian.getByRole("button", { name: /Саша • демо/ }),
      ).toHaveCount(operation === "create" ? 1 : 0);
    } finally {
      await revoker.close();
      await guardian.close();
    }
  });
