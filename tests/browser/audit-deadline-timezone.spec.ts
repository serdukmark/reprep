import { test, expect } from "./audit-fixtures";
test.use({ timezoneId: "Europe/Berlin" });
test("deadline keeps the entered local hour across a daylight-saving boundary", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  const value = await page.evaluate(
    () =>
      `${new Date().getFullYear() + 1}-${new Date().getTimezoneOffset() === -120 ? "01" : "07"}-15T18:00`,
  );
  await page.getByLabel("Дедлайн (ваш часовой пояс)").fill(value);
  await expect(page.getByLabel("Дедлайн (ваш часовой пояс)")).toHaveValue(
    value,
  );
  await page.getByLabel("Название работы").fill("Проверка часового пояса");
  await page.getByLabel("Условие", { exact: true }).fill("2+3?");
  await page.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await page.getByLabel("Навык", { exact: true }).fill("Сложение");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Проверка часового пояса", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await expect(page.getByLabel("Дедлайн (ваш часовой пояс)")).toHaveValue(
    value,
  );
});
