import { test, expect } from "./audit-fixtures";
test("published assignment stays immutable and retrying a lost duplicate response creates one private copy", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Редактировать", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/assignments/*/duplicate", async (route) => {
    expect((await route.fetch()).ok()).toBeTruthy();
    await route.abort();
  });
  await page
    .getByRole("button", { name: "Создать копию", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.unroute("**/api/assignments/*/duplicate");
  await page
    .getByRole("button", { name: "Создать копию", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Редактирование работы", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Название работы")).toHaveValue(
    "Линейные уравнения: от шага к решению · копия",
  );
  await page.getByRole("button", { name: "К заданиям", exact: true }).click();
  await page.getByPlaceholder("Найти задание").fill("· копия");
  await expect(page.locator(".assignment-row")).toHaveCount(1);
  const learner = await context.newPage();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner.getByRole("button", { name: "Задания", exact: true }).click();
  await learner.getByPlaceholder("Найти задание").fill("· копия");
  await expect(learner.locator(".assignment-row")).toHaveCount(0);
  await learner.close();
});
