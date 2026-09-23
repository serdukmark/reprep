import { test, expect } from "./audit-fixtures";
test("AUD-005 retry after server committed draft but response was lost does not create duplicate", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await page.getByLabel("Название работы").fill("Ответ сервера потерян");
  await page.getByLabel("Условие", { exact: true }).fill("2+2?");
  await page.getByLabel("Эталонный ответ", { exact: true }).fill("4");
  await page.getByLabel("Навык", { exact: true }).fill("Сложение");
  await page.route("**/api/assignments", async (route) => {
    if (route.request().method() === "POST") {
      const r = await route.fetch();
      expect(r.status()).toBe(201);
      await route.abort();
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Название работы")).toHaveValue(
    "Ответ сервера потерян",
  );
  await page.unroute("**/api/assignments");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ответ сервера потерян", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await expect(page.locator(".assignment-row")).toHaveCount(1);
});
