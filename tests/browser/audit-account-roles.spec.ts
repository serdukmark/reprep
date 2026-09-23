import { test, expect } from "./audit-fixtures";
import { readFile } from "node:fs/promises";

for (const [persona, button, alias] of [
  ["tutor", "Я преподаватель", "Алекс • демо"],
  ["guardian", "Я родитель", "Родитель • демо"],
  ["outsider", "Другой преподаватель · демо", "Другой репетитор • демо"],
])
  test(`${persona}: export own data and cancel deletion`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: button, exact: true }).click();
    if (persona !== "guardian")
      await page.getByRole("button", { name: new RegExp(alias) }).click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Скачать мои данные", exact: true })
      .click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("reprep-my-data.json");
    const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
    expect(exported.account.id).toBe("demo-" + persona);
    expect(JSON.stringify(exported)).not.toContain("token_hash");
    if (persona === "guardian") expect(exported.assignments).toEqual([]);
    await page.getByLabel("Имя для запроса удаления").fill(alias);
    await page
      .getByRole("button", { name: "Запросить удаление аккаунта", exact: true })
      .click();
    await expect(
      page.getByText("Запрос на удаление ожидает обработки владельцем."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Отменить запрос на удаление", exact: true })
      .click();
    await expect(
      page.getByText("Запрос отменён", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Запросить удаление аккаунта",
        exact: true,
      }),
    ).toBeVisible();
  });
