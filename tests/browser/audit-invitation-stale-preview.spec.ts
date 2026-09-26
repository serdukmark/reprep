import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";

async function tutorLearners(page: Page) {
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ученики", exact: true }),
  ).toBeVisible();
}

async function newLearnerInvite(tutor: Page, previous = "") {
  await tutor
    .getByRole("button", { name: "Пригласить ученика", exact: true })
    .click();
  await expect(tutor.locator(".invite-box code")).toBeVisible();
  if (previous)
    await expect(tutor.locator(".invite-box code")).not.toHaveText(previous);
  return tutor.locator(".invite-box code").innerText();
}

for (const decision of ["accept", "decline"] as const)
  test(`learner invitation ${decision}: tutor revocation after successful preview rejects stale action and fresh code recovers`, async ({
    page,
    browser,
  }) => {
    const tutor = await browser.newPage();
    const invitations = () =>
      tutor
        .locator("section.card")
        .filter({
          has: tutor.getByRole("heading", { name: "Приглашения", exact: true }),
        });
    try {
      await tutor.goto("/");
      await tutor
        .getByRole("button", { name: "Я преподаватель", exact: true })
        .click();
      await tutorLearners(tutor);
      const code = await newLearnerInvite(tutor);
      // The audit identity enters through the normal login UI and starts with
      // no study relationships, making an unintended acceptance observable.
      await page.route("**/api/auth/demo/learner", (route) =>
        route.continue({
          url: new URL("/__audit__/identity/learner", route.request().url())
            .href,
        }),
      );
      await page.goto("/");
      await page.getByRole("button", { name: "Я ученик", exact: true }).click();
      await page
        .getByRole("button", { name: "Мой прогресс", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Начните со знакомства",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".learner-list button")).toHaveCount(0);
      await page.getByRole("button", { name: /Новый ученик • аудит/ }).click();
      await page.getByLabel("Код приглашения", { exact: true }).fill(code);
      const preview = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/invitations/preview" &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Посмотреть приглашение", exact: true })
        .click();
      expect((await preview).status()).toBe(200);
      await expect(page.getByText(/Преподаватель: Алекс • демо/)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Принять приглашение", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Отклонить приглашение",
          exact: true,
        }),
      ).toBeVisible();

      // Keep that successful preview mounted while a different user's page
      // revokes the invite. Neither submission nor response is substituted.
      const revoked = tutor.waitForResponse(
        (r) =>
          /\/api\/invitations\/[^/]+\/revoke$/.test(
            new URL(r.url()).pathname,
          ) && r.request().method() === "POST",
      );
      await tutor
        .getByRole("button", { name: "Отозвать", exact: true })
        .click();
      expect((await revoked).status()).toBe(200);
      await expect(invitations()).toContainText("Отозвано");
      const denied = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/invitations/${decision}` &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", {
          name:
            decision === "accept"
              ? "Принять приглашение"
              : "Отклонить приглашение",
          exact: true,
        })
        .click();
      expect((await denied).status()).toBe(410);
      await expect(page.getByRole("alert").first()).toContainText(
        "Приглашение недействительно или уже использовано",
      );
      await expect(
        page.getByLabel("Код приглашения", { exact: true }),
      ).toHaveValue(code);
      await expect(
        page.getByText("Вы подключились к преподавателю", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Приглашение отклонено", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Мой прогресс", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Начните со знакомства",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".learner-list button")).toHaveCount(0);
      await tutor.reload();
      await tutorLearners(tutor);
      await expect(
        tutor.getByRole("button", { name: /Новый ученик • аудит/ }),
      ).toHaveCount(0);
      await expect(invitations().locator(".line")).toHaveCount(1);
      await expect(invitations()).toContainText("Отозвано");
      await expect(invitations()).not.toContainText("Отклонено");

      const fresh = await newLearnerInvite(tutor, code);
      await page.getByRole("button", { name: /Новый ученик • аудит/ }).click();
      await page.getByLabel("Код приглашения", { exact: true }).fill(fresh);
      await page
        .getByRole("button", { name: "Посмотреть приглашение", exact: true })
        .click();
      await expect(page.getByText(/Преподаватель: Алекс • демо/)).toBeVisible();
      const accepted = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/invitations/accept" &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Принять приглашение", exact: true })
        .click();
      expect((await accepted).status()).toBe(200);
      await expect(
        page.getByText("Вы подключились к преподавателю", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Мой прогресс", exact: true })
        .click();
      await expect(page.locator(".learner-list button")).toHaveCount(1);
      await expect(page.locator(".learner-list")).toContainText("Алекс • демо");
      await page.reload();
      await page
        .getByRole("button", { name: "Мой прогресс", exact: true })
        .click();
      await expect(page.locator(".learner-list button")).toHaveCount(1);
      await tutor.reload();
      await tutorLearners(tutor);
      await expect(
        tutor.getByRole("button", { name: /Новый ученик • аудит/ }),
      ).toHaveCount(1);
      await expect(
        invitations().locator(".line").filter({ hasText: "Отозвано" }),
      ).toHaveCount(1);
      await expect(
        invitations().locator(".line").filter({ hasText: "Принято" }),
      ).toHaveCount(1);
    } finally {
      await tutor.close();
    }
  });

test("guardian prefilled invitation: revocation in tutor page denies acceptance and fresh code grants one child", async ({
  page,
  browser,
}) => {
  const tutor = await browser.newPage();
  const access = () =>
    tutor
      .locator("section.card")
      .filter({
        has: tutor.getByRole("heading", {
          name: "Доступ родителя",
          exact: true,
        }),
      });
  const selectChild = async () => {
    await tutorLearners(tutor);
    await tutor.getByRole("button", { name: /Саша • демо/ }).click();
    await expect(access()).toBeVisible();
  };
  try {
    await tutor.goto("/");
    await tutor
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await selectChild();
    await tutor
      .getByRole("button", {
        name: "Создать приглашение родителю",
        exact: true,
      })
      .click();
    const code = await tutor
      .getByLabel("Код родителя", { exact: true })
      .inputValue();
    await page.goto("/");
    await page.getByRole("button", { name: "Я родитель", exact: true }).click();
    await expect(page.getByText(/Открытых доступов нет/)).toBeVisible();
    await page
      .getByLabel("Код приглашения родителю", { exact: true })
      .fill(code);
    await expect(
      page.getByRole("button", { name: "Принять доступ", exact: true }),
    ).toBeEnabled();
    const revoked = tutor.waitForResponse(
      (r) =>
        /\/api\/guardian\/invitations\/[^/]+\/revoke$/.test(
          new URL(r.url()).pathname,
        ) && r.request().method() === "POST",
    );
    await tutor
      .getByRole("button", { name: "Отозвать доступ родителя", exact: true })
      .click();
    expect((await revoked).status()).toBe(200);
    await expect(access()).toContainText("Отозвано");
    await expect(
      page.getByLabel("Код приглашения родителю", { exact: true }),
    ).toHaveValue(code);
    const denied = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/guardian/accept" &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Принять доступ", exact: true })
      .click();
    expect((await denied).status()).toBe(404);
    await expect(page.getByRole("alert").first()).toContainText(
      "Приглашение недоступно",
    );
    await expect(
      page.getByLabel("Код приглашения родителю", { exact: true }),
    ).toHaveValue(code);
    await expect(page.getByText(/Открытых доступов нет/)).toBeVisible();
    await expect(page.locator(".filters button")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Расписание ученика", exact: true }),
    ).toHaveCount(0);
    await tutor.reload();
    await selectChild();
    await expect(access()).toContainText("Отозвано");
    await expect(access()).not.toContainText("Доступ открыт");
    await tutor
      .getByRole("button", {
        name: "Создать приглашение родителю",
        exact: true,
      })
      .click();
    const fresh = await tutor
      .getByLabel("Код родителя", { exact: true })
      .inputValue();
    expect(fresh === code).toBe(false);
    await page
      .getByLabel("Код приглашения родителю", { exact: true })
      .fill(fresh);
    const accepted = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/guardian/accept" &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Принять доступ", exact: true })
      .click();
    expect((await accepted).status()).toBe(200);
    await expect(page.locator(".filters button")).toHaveCount(1);
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    await expect(
      page.getByRole("heading", { name: "Расписание ученика", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Разбираем уравнения", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator(".filters button")).toHaveCount(1);
    await page.getByRole("button", { name: /Саша • демо/ }).click();
    await expect(
      page.getByRole("heading", {
        name: "Подтверждённый прогресс",
        exact: true,
      }),
    ).toBeVisible();
    await tutor.reload();
    await selectChild();
    await expect(
      access().locator(".form-actions").filter({ hasText: "Отозвано" }),
    ).toHaveCount(1);
    await expect(
      access().locator(".form-actions").filter({ hasText: "Доступ открыт" }),
    ).toHaveCount(1);
  } finally {
    await tutor.close();
  }
});
