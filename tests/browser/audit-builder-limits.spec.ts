import { test, expect, choose } from "./audit-fixtures";
test("builder validates numeric reference, choice cardinality and limits twenty tasks", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Назначить ученику", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Название работы").fill("Пределы конструктора");
  for (const [label, max] of [
    ["Условие", 3000],
    ["Эталонный ответ", 1000],
    ["Навык", 100],
    ["Критерии проверки", 2000],
    ["Подсказка ученику (без готового ответа)", 1000],
  ] as [string, number][]) {
    await page
      .getByRole("textbox", { name: label, exact: true })
      .fill("Я".repeat(max + 20));
    expect(
      (
        await page
          .getByRole("textbox", { name: label, exact: true })
          .inputValue()
      ).length,
    ).toBeLessThanOrEqual(max);
  }
  await page
    .getByRole("textbox", { name: "Условие", exact: true })
    .fill("2+3?");
  await page.getByLabel("Навык", { exact: true }).fill("Сложение");
  await page
    .getByRole("textbox", { name: "Критерии проверки", exact: true })
    .fill("");
  await page
    .getByLabel("Подсказка ученику (без готового ответа)", { exact: true })
    .fill("");
  await page.getByLabel("Эталонный ответ", { exact: true }).fill("Infinity");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Название работы")).toHaveValue(
    "Пределы конструктора",
  );
  await choose(
    page.locator(".task-editor").getByRole("combobox").first(),
    "single_choice",
  );
  for (const options of [
    "Один",
    "Один\nОдин",
    Array.from({ length: 9 }, (_, i) => String(i)).join("\n"),
  ]) {
    await page.getByLabel("Варианты (каждый с новой строки)").fill(options);
    await choose(
      page.getByRole("combobox", { name: "Эталонный ответ", exact: true }),
      { index: 0 },
    );
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/assignments") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Сохранить черновик", exact: true })
      .click();
    expect((await response).status()).toBe(422);
    await expect(page.getByRole("alert")).toBeVisible();
  }
  await page
    .getByLabel("Варианты (каждый с новой строки)")
    .fill("Первый\nВторой");
  await choose(
    page.getByRole("combobox", { name: "Эталонный ответ", exact: true }),
    "Второй",
  );
  for (let i = 1; i < 20; i++)
    await page
      .getByRole("button", { name: "Добавить задание", exact: true })
      .click();
  await expect(page.locator(".task-editor")).toHaveCount(20);
  await expect(
    page.getByRole("button", { name: "Добавить задание", exact: true }),
  ).toHaveCount(0);
  for (let i = 20; i > 1; i--)
    await page
      .getByRole("button", { name: "Удалить задание " + i, exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "Удалить задание 1", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Пределы конструктора", exact: true }),
  ).toBeVisible();
});
