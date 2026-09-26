import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";

for (const mode of ["create", "revoke"])
  test(`guardian invitation ${mode}: foreign relationship or invitation stays private and unchanged`, async ({
    page,
    browser,
  }) => {
    const foreign = await browser.newPage(),
      child = await browser.newPage(),
      guardian = await browser.newPage();
    const open = async (p: Page, alias: RegExp) => {
      await p.getByRole("button", { name: "Ученики", exact: true }).click();
      await p.getByRole("button", { name: alias }).click();
      await expect(
        p.getByRole("heading", { name: "Доступ родителя", exact: true }),
      ).toBeVisible();
    };
    const create = (p: Page) =>
      p.getByRole("button", {
        name: "Создать приглашение родителю",
        exact: true,
      });
    const revoke = (p: Page) =>
      p.getByRole("button", { name: "Отозвать доступ родителя", exact: true });
    try {
      await foreign.goto("/");
      await foreign
        .getByRole("button", {
          name: "Другой преподаватель · демо",
          exact: true,
        })
        .click();
      await foreign
        .getByRole("button", { name: "Ученики", exact: true })
        .click();
      await foreign
        .getByRole("button", { name: "Пригласить ученика", exact: true })
        .click();
      const learnerCode = await foreign.locator(".invite-box code").innerText();
      await child.route("**/api/auth/demo/learner", (route) =>
        route.continue({
          url: new URL("/__audit__/identity/learner", route.request().url())
            .href,
        }),
      );
      await child.goto("/");
      await child
        .getByRole("button", { name: "Я ученик", exact: true })
        .click();
      await child.getByRole("button", { name: /Новый ученик • аудит/ }).click();
      await child
        .getByLabel("Код приглашения", { exact: true })
        .fill(learnerCode);
      await child
        .getByRole("button", { name: "Посмотреть приглашение", exact: true })
        .click();
      await child
        .getByRole("button", { name: "Принять приглашение", exact: true })
        .click();
      await expect(
        child.getByText("Вы подключились к преподавателю", { exact: true }),
      ).toBeVisible();
      await foreign.reload();
      await open(foreign, /Новый ученик • аудит/);
      const made = foreign.waitForResponse(
        (r) =>
          /\/api\/relationships\/[^/]+\/guardians$/.test(r.url()) &&
          r.request().method() === "POST",
      );
      await create(foreign).click();
      const response = await made;
      expect(response.status()).toBe(201);
      const foreignPath = new URL(response.url()).pathname;
      const foreignId = (await response.json()).id;
      expect(typeof foreignId).toBe("string");
      const foreignCode = await foreign
        .getByLabel("Код родителя", { exact: true })
        .inputValue();
      await page.goto("/");
      await page
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
      await open(page, /Саша • демо/);
      if (mode === "revoke") await create(page).click();
      const ownCode =
        mode === "revoke"
          ? await page.getByLabel("Код родителя", { exact: true }).inputValue()
          : "";
      const pattern =
        mode === "create"
          ? "**/api/relationships/demo-link/guardians"
          : "**/api/guardian/invitations/*/revoke";
      let denied = 0;
      await page.route(pattern, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const path =
          mode === "create"
            ? foreignPath
            : `/api/guardian/invitations/${foreignId}/revoke`;
        const response = await route.fetch({
          url: new URL(path, route.request().url()).href,
        });
        expect(response.status()).toBe(404);
        denied++;
        await route.fulfill({ response });
      });
      await (mode === "create" ? create(page) : revoke(page)).click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      expect(denied).toBe(1);
      if (mode === "create") {
        await expect(
          page.getByLabel("Код родителя", { exact: true }),
        ).toHaveCount(0);
        await expect(revoke(page)).toHaveCount(0);
      } else {
        await expect(
          page.getByLabel("Код родителя", { exact: true }),
        ).toHaveValue(ownCode);
        await expect(revoke(page)).toHaveCount(1);
      }
      await foreign.reload();
      await open(foreign, /Новый ученик • аудит/);
      await expect(revoke(foreign)).toHaveCount(1);
      // A real acceptance proves the foreign invite was not revoked or replaced.
      await guardian.goto("/");
      await guardian
        .getByRole("button", { name: "Я родитель", exact: true })
        .click();
      const accept = async (code: string, alias: RegExp) => {
        await guardian.getByLabel("Код приглашения родителю").fill(code);
        await guardian
          .getByRole("button", { name: "Принять доступ", exact: true })
          .click();
        await expect(guardian.getByRole("button", { name: alias })).toHaveCount(
          1,
        );
      };
      await accept(foreignCode, /Новый ученик • аудит/);
      if (mode === "revoke") await accept(ownCode, /Саша • демо/);
      await page.unroute(pattern);
      await (mode === "create" ? create(page) : revoke(page)).click();
      if (mode === "create") {
        const freshCode = await page
          .getByLabel("Код родителя", { exact: true })
          .inputValue();
        await accept(freshCode, /Саша • демо/);
      } else {
        await expect(revoke(page)).toHaveCount(0);
        await expect(
          page.getByLabel("Код родителя", { exact: true }),
        ).toHaveCount(0);
      }
      await page.reload();
      await open(page, /Саша • демо/);
      await expect(revoke(page)).toHaveCount(mode === "create" ? 1 : 0);
      await guardian.reload();
      await expect(
        guardian.getByRole("button", { name: /Новый ученик • аудит/ }),
      ).toHaveCount(1);
      await expect(
        guardian.getByRole("button", { name: /Саша • демо/ }),
      ).toHaveCount(mode === "create" ? 1 : 0);
    } finally {
      await foreign.close();
      await child.close();
      await guardian.close();
    }
  });
