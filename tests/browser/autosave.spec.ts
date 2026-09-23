import { test, expect } from "./audit-fixtures";

test("answers autosave and survive reload without the save button", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик" }).click();
  await page
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await page.getByLabel("Ответ на задание 1").fill("7");
  await expect(page.getByRole("status")).toHaveText("Сохранено", {
    timeout: 10000,
  });
  await page.reload();
  await page
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("7");
  await page.route("**/api/assignments/*/draft", (route) => route.abort());
  await page.getByLabel("Ответ на задание 1").fill("8");
  await expect(page.locator(".save-error")).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("8");
  await page.unroute("**/api/assignments/*/draft");
  await page.getByRole("button", { name: "Сохранить ответы" }).click();
  await expect(page.getByRole("status")).toHaveText("Сохранено");
});
