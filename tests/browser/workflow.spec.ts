import { test, expect } from "@playwright/test";
test("tutor assigns, learner saves/submits, real worker analyzes, tutor approves, learner sees progress", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  const errors: string[] = [];
  for (const p of [tutor, learner])
    p.on("pageerror", (e) => errors.push(e.message));
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await expect(
    tutor.getByRole("heading", { name: "Хороший день, чтобы учить." }),
  ).toBeVisible();
  await tutor.screenshot({
    path: "artifacts/ui-dashboard.png",
    fullPage: true,
  });
  await tutor.getByRole("button", { name: "Создать задание" }).click();
  const title = "Браузерная проверка " + Date.now();
  await tutor.getByLabel("Название работы").fill(title);
  await tutor.getByLabel("Ученик", { exact: true }).selectOption("demo-link");
  await tutor
    .getByLabel("Условие", { exact: true })
    .fill("Решите уравнение 3x + 7 = 22.");
  await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await tutor.getByLabel("Навык", { exact: true }).fill("Линейные уравнения");
  await tutor
    .getByLabel("Критерии проверки")
    .fill("Вычесть 7, затем разделить на 3.");
  await tutor.getByRole("button", { name: "Назначить ученику" }).click();
  await expect(
    tutor.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await expect(learner.getByText("Эталон и критерии")).toHaveCount(0);
  await learner.getByLabel("Ответ на задание 1").fill("5");
  learner.once("dialog", (d) => d.dismiss());
  await learner.getByRole("button", { name: "Материалы", exact: true }).click();
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue("5");
  await learner.route("**/api/assignments/*/draft", (route) => route.abort());
  await learner.getByRole("button", { name: "Сохранить ответы" }).click();
  await expect(learner.locator(".save-error")).toBeVisible();
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue("5");
  await learner.unroute("**/api/assignments/*/draft");
  await learner.getByRole("button", { name: "Сохранить ответы" }).click();
  await expect(learner.getByRole("status")).toHaveText("Сохранено");
  await learner.reload();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue("5");
  learner.once("dialog", (d) => d.accept());
  await learner.getByRole("button", { name: "Отправить работу" }).click();
  await expect(learner.getByText("ОРИГИНАЛЬНЫЙ ОТВЕТ УЧЕНИКА")).toBeVisible();
  await expect(
    learner.getByText("Предварительный разбор", { exact: true }),
  ).toHaveCount(0);
  await tutor.reload();
  await tutor.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    tutor.getByText("Предварительный разбор", { exact: true }),
  ).toBeVisible({ timeout: 70000 });
  if (process.env.E2E_EXPECT_MODEL)
    await expect(tutor.locator(".notice")).toContainText(
      process.env.E2E_EXPECT_MODEL,
    );
  await tutor.screenshot({
    path: "artifacts/ui-ai-review.png",
    fullPage: true,
  });
  await tutor
    .getByRole("button", { name: "Подтвердить разбор", exact: true })
    .click();
  await expect(
    tutor.getByText("Проверено преподавателем", { exact: true }),
  ).toBeVisible();
  await learner.reload();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    learner.getByText("Проверено преподавателем", { exact: true }),
  ).toBeVisible();
  await learner
    .getByRole("button", { name: "История попыток", exact: true })
    .click();
  await learner
    .locator(".attempt-history")
    .getByRole("button", { name: /Попытка 1/ })
    .click();
  await expect(learner.locator(".attempt-detail .original p")).toHaveText("5");
  await expect(
    learner
      .locator(".attempt-detail")
      .getByText("Предварительный AI-разбор этой попытки"),
  ).toHaveCount(0);
  await learner
    .getByRole("button", { name: "Мой прогресс", exact: true })
    .click();
  await expect(
    learner.getByText("Линейные уравнения", { exact: true }),
  ).toBeVisible();
  await learner.setViewportSize({ width: 390, height: 844 });
  await learner.screenshot({
    path: "artifacts/ui-mobile-progress.png",
    fullPage: true,
  });
  expect(
    await learner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await tutor.close();
  await learner.close();
});

test("schedule, private payment note, material link and revocable invite", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor.getByRole("button", { name: "Расписание", exact: true }).click();
  await tutor.getByRole("button", { name: "Добавить занятие" }).click();
  const title = "Разбор ошибок " + Date.now();
  await tutor.getByLabel("Название", { exact: true }).fill(title);
  await tutor.locator("select[name=relationship_id]").selectOption("demo-link");
  await tutor.getByLabel("Начало (ваш часовой пояс)").fill("2026-09-25T17:00");
  await tutor.getByRole("button", { name: "Сохранить", exact: true }).click();
  const lesson = tutor
    .locator(".lesson-row")
    .filter({ has: tutor.getByRole("heading", { name: title }) });
  await lesson
    .getByRole("combobox", { name: "Ваша отметка об оплате", exact: true })
    .selectOption("paid");
  await expect(
    lesson.getByRole("combobox", {
      name: "Ваша отметка об оплате",
      exact: true,
    }),
  ).toHaveValue("paid");
  await tutor.getByRole("button", { name: "Материалы", exact: true }).click();
  await tutor.getByRole("button", { name: "Добавить материал" }).click();
  await tutor.getByLabel("Название", { exact: true }).fill(title);
  await tutor.locator("select[name=relationship_id]").selectOption("demo-link");
  await tutor.getByLabel("Ссылка HTTPS").fill("https://example.org/math");
  await tutor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(tutor.getByRole("heading", { name: title })).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner
    .getByRole("button", { name: "Расписание", exact: true })
    .click();
  await expect(learner.getByRole("heading", { name: title })).toBeVisible();
  await expect(learner.getByText("Ваша отметка об оплате")).toHaveCount(0);
  await learner.getByRole("button", { name: "Материалы", exact: true }).click();
  await expect(learner.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    learner.getByRole("link", { name: "Открыть материал" }).last(),
  ).toHaveAttribute("href", "https://example.org/math");
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor.getByRole("button", { name: "Пригласить ученика" }).click();
  await expect(
    tutor.getByRole("heading", { name: "Приглашение создано" }),
  ).toBeVisible();
  await tutor
    .getByRole("button", { name: "Отозвать", exact: true })
    .last()
    .click();
  await expect(tutor.getByText(/· Отозвано/).last()).toBeVisible();
  await tutor.close();
  await learner.close();
});
