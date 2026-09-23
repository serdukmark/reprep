import { test, expect, choose } from "./audit-fixtures";
test("AUD-001 named choice control is keyboard-accessible and saves a new tutor draft", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await page.getByLabel("Название работы").fill("Первый черновик 🧪 <script>");
  const pupil = page.getByRole("combobox", { name: "Ученик", exact: true });
  await expect(pupil).toBeVisible({ timeout: 3000 });
  await pupil.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pupil).toBeFocused();
  await page.getByLabel("Условие", { exact: true }).fill("2+2?");
  await page.getByLabel("Эталонный ответ", { exact: true }).fill("4");
  await page.getByLabel("Навык", { exact: true }).fill("Сложение");
  await expect(
    page.getByRole("button", { name: "Назначить ученику" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Первый черновик 🧪 <script>",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await choose(
    page.getByRole("combobox", { name: "Статус работ", exact: true }),
    "draft",
  );
  await expect(page.locator(".assignment-row")).toHaveCount(1);
  await expect(page.locator(".assignment-row")).toContainText(
    "Ученик не выбран",
  );
});

test("choice popup handles long labels on narrow screen and keyboard selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await choose(
    page.getByRole("combobox", { name: "Формат ответа", exact: true }),
    "single_choice",
  );
  const text = "Длинный вариант Ё 🧪 ".repeat(15);
  await page
    .getByLabel("Варианты (каждый с новой строки)")
    .fill("Короткий\n" + text.trim());
  const answer = page.getByRole("combobox", {
    name: "Эталонный ответ",
    exact: true,
  });
  await answer.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await expect(page.getByRole("option").last()).toBeVisible();
  const bounds = await page.getByRole("listbox").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press("Enter");
  await expect(answer).toHaveText(text.trim());
  await expect(answer).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
