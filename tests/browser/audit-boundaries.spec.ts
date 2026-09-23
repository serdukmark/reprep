import { test, expect, choose } from "./audit-fixtures";

test("all task types validate, preserve Unicode and reject empty form without sending", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  let posts = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/assignments") && r.method() === "POST") posts++;
  });
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  expect(posts).toBe(0);
  expect(
    await page
      .getByLabel("Название работы")
      .evaluate((e: HTMLInputElement) => e.validity.valueMissing),
  ).toBe(true);
  await page.getByLabel("Название работы").fill("Я".repeat(300));
  expect(
    (await page.getByLabel("Название работы").inputValue()).length,
  ).toBeLessThanOrEqual(160);
  await page
    .getByLabel("Название работы")
    .fill("Алгебра 🧪 <script>alert(1)</script> & Ё");
  await page
    .getByLabel("Условие", { exact: true })
    .fill('Найдите x: 2x = 8. Символы < > & " Ё 🧪');
  await page.getByLabel("Эталонный ответ", { exact: true }).fill("4");
  await page.getByLabel("Навык", { exact: true }).fill("Уравнения");
  await page
    .getByRole("button", { name: "Добавить задание", exact: true })
    .click();
  await choose(
    page.locator(".task-editor").nth(1).getByRole("combobox").first(),
    "single_choice",
  );
  await page
    .locator(".task-editor")
    .nth(1)
    .getByLabel("Условие", { exact: true })
    .fill("Выберите число");
  await page
    .locator(".task-editor")
    .nth(1)
    .getByLabel(/Варианты/)
    .fill("Один\nДва");
  await choose(
    page.locator(".task-editor").nth(1).getByRole("combobox").last(),
    "Два",
  );
  await page
    .locator(".task-editor")
    .nth(1)
    .getByLabel("Навык", { exact: true })
    .fill("Выбор");
  await page
    .getByRole("button", { name: "Добавить задание", exact: true })
    .click();
  await choose(
    page.locator(".task-editor").nth(2).getByRole("combobox").first(),
    "short_text",
  );
  await page
    .locator(".task-editor")
    .nth(2)
    .getByLabel("Условие", { exact: true })
    .fill("Объясните решение");
  await page
    .locator(".task-editor")
    .nth(2)
    .getByLabel("Эталонный ответ", { exact: true })
    .fill("Делим на два");
  await page
    .locator(".task-editor")
    .nth(2)
    .getByLabel("Навык", { exact: true })
    .fill("Рассуждение");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", {
      name: "Алгебра 🧪 <script>alert(1)</script> & Ё",
      exact: true,
    }),
  ).toBeVisible();
  expect(posts).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await expect(page.locator(".assignment-row")).toHaveCount(1);
  await page.locator(".assignment-row").click();
  await expect(page.locator(".work-task")).toHaveCount(3);
});

test("learner preserves answer when session expires and rejects stale writes from a second tab", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const a = await context.newPage();
  await a.goto("/");
  await a.getByRole("button", { name: "Я ученик", exact: true }).click();
  await expect(
    a.getByRole("button", { name: /Линейные уравнения: от шага к решению/ }),
  ).toBeVisible();
  const token = await a.evaluate(() =>
    sessionStorage.getItem("reprep.session"),
  );
  const b = await context.newPage();
  await b.addInitScript(
    (t) => sessionStorage.setItem("reprep.session", t!),
    token,
  );
  await b.goto("/");
  const work = /Линейные уравнения: от шага к решению/;
  await a.getByRole("button", { name: work }).click();
  await b.getByRole("button", { name: work }).click();
  await a.getByLabel("Ответ на задание 1").fill("71");
  await expect(a.getByRole("status")).toHaveText("Сохранено");
  await b.getByLabel("Ответ на задание 1").fill("82");
  await expect(b.locator(".save-error")).toBeVisible();
  await expect(b.getByLabel("Ответ на задание 1")).toHaveValue("82");
  await a.reload();
  await a.getByRole("button", { name: work }).click();
  await expect(a.getByLabel("Ответ на задание 1")).toHaveValue("71");
  await a.evaluate(async () => {
    await fetch("/api/logout", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + sessionStorage.getItem("reprep.session"),
      },
    });
  });
  await a.getByLabel("Ответ на задание 1").fill("93");
  await expect(a.locator(".save-error")).toContainText(/Войдите|Сессия/);
  await expect(a.getByLabel("Ответ на задание 1")).toHaveValue("93");
  a.once("dialog", (d) => d.accept());
  await a.reload();
  await expect(
    a.getByRole("button", { name: "Я ученик", exact: true }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Я ученик", exact: true }).click();
  await a.getByRole("button", { name: work }).click();
  await expect(a.getByLabel("Ответ на задание 1")).toHaveValue("71");
  await context.close();
});
