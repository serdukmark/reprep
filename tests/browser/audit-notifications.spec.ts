import { test, expect } from "./audit-fixtures";
for (const role of ["tutor", "learner"])
  test(`${role}: notification opt-in requires contact, survives offline retry and can be disabled`, async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", {
        name: role === "tutor" ? "Я преподаватель" : "Я ученик",
        exact: true,
      })
      .click();
    const profile = () =>
      page
        .getByRole("button", {
          name: role === "tutor" ? /Алекс • демо/ : /Саша • демо/,
        })
        .click();
    await profile();
    await expect(page.getByLabel("О ближайших занятиях")).toBeDisabled();
    expect(
      (await request.post("/__audit__/notification-contacts")).ok(),
    ).toBeTruthy();
    await page.reload();
    await profile();
    await expect(page.getByLabel("О ближайших занятиях")).toBeEnabled();
    await expect(
      page.getByText("Диалог с ботом открыт.", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("О ближайших занятиях").check();
    if (role === "learner") await page.getByLabel("О сроках заданий").check();
    else await expect(page.getByLabel("О сроках заданий")).toHaveCount(0);
    await page.route("**/api/notifications", (route) =>
      route.request().method() === "PUT" ? route.abort() : route.continue(),
    );
    await page
      .getByRole("button", { name: "Сохранить напоминания", exact: true })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("О ближайших занятиях")).toBeChecked();
    await page.unroute("**/api/notifications");
    await page
      .getByRole("button", { name: "Сохранить напоминания", exact: true })
      .click();
    await expect(
      page.getByText("Настройки напоминаний сохранены", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await profile();
    await expect(page.getByLabel("О ближайших занятиях")).toBeChecked();
    if (role === "learner")
      await expect(page.getByLabel("О сроках заданий")).toBeChecked();
    await page.getByLabel("О ближайших занятиях").uncheck();
    if (role === "learner") await page.getByLabel("О сроках заданий").uncheck();
    await page
      .getByRole("button", { name: "Сохранить напоминания", exact: true })
      .click();
    await expect(
      page.getByText("Настройки напоминаний сохранены", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await profile();
    await expect(page.getByLabel("О ближайших занятиях")).not.toBeChecked();
  });
