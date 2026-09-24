import { test, expect } from "./audit-fixtures";
for (const [role, button, alias] of [
  ["tutor", "Я преподаватель", "Алекс • демо"],
  ["learner", "Я ученик", "Саша • демо"],
  ["guardian", "Я родитель", "Родитель • демо"],
  ["colleague", "Другой преподаватель · демо", "Другой репетитор • демо"],
])
  test(`${role}: account export and deletion fail visibly, retry once and survive reload`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: button, exact: true }).click();
    const open = async () => {
      if (role !== "guardian")
        await page.getByRole("button", { name: new RegExp(alias) }).click();
    };
    await open();
    const section = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Мои данные", exact: true }),
      })
      .last();
    const remove = section.getByRole("button", {
      name: "Запросить удаление аккаунта",
      exact: true,
    });
    await expect(remove).toBeDisabled();
    await page
      .getByLabel("Имя для запроса удаления")
      .fill("Несовпадающее имя 🧪");
    await expect(remove).toBeDisabled();
    await page.getByLabel("Имя для запроса удаления").fill("Я".repeat(120));
    expect(
      (await page.getByLabel("Имя для запроса удаления").inputValue()).length,
    ).toBe(60);
    await expect(remove).toBeDisabled();
    await page.getByLabel("Имя для запроса удаления").fill(alias);
    await page.route("**/api/account/**", (route) =>
      route.abort("connectionreset"),
    );
    await section
      .getByRole("button", { name: "Скачать мои данные", exact: true })
      .click();
    await expect(section.getByRole("alert")).toBeVisible();
    await expect(
      section.getByText("Файл экспорта передан браузеру", { exact: true }),
    ).toHaveCount(0);
    await remove.click();
    await expect(section.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Имя для запроса удаления")).toHaveValue(
      alias,
    );
    await expect(
      section.getByText("Запрос на удаление ожидает обработки владельцем."),
    ).toHaveCount(0);
    await page.unroute("**/api/account/**");
    const download = page.waitForEvent("download");
    await section
      .getByRole("button", { name: "Скачать мои данные", exact: true })
      .click();
    await download;
    await expect(section.getByRole("status")).toHaveText(
      "Файл экспорта передан браузеру",
    );
    await remove.dblclick();
    await expect(
      section.getByText("Запрос на удаление ожидает обработки владельцем."),
    ).toBeVisible();
    await page.reload();
    await open();
    await expect(
      section.getByText("Запрос на удаление ожидает обработки владельцем."),
    ).toBeVisible();
    // Lose the acknowledgement after the cancellation really committed.
    await page.route("**/api/account/deletion/cancel", async (route) => {
      await route.fetch();
      await route.abort("connectionreset");
    });
    await section
      .getByRole("button", { name: "Отменить запрос на удаление", exact: true })
      .click();
    await expect(section.getByRole("alert")).toBeVisible();
    await expect(
      section.getByText("Запрос отменён", { exact: true }),
    ).toHaveCount(0);
    await page.unroute("**/api/account/deletion/cancel");
    await page.reload();
    await open();
    await expect(remove).toBeVisible();
    await expect(
      section.getByText("Запрос на удаление ожидает обработки владельцем."),
    ).toHaveCount(0);
  });
