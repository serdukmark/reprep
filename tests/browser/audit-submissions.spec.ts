import { test, expect, choose } from "./audit-fixtures";

test("oversized AI context retains uploaded work for manual review without unsafe retry", async ({
  context,
}) => {
  const learner = await context.newPage(),
    tutor = await context.newPage();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  const file = learner.getByLabel("TXT к заданию 1");
  for (const [name, buffer] of [
    ["bad.exe", Buffer.from("x")],
    ["empty.txt", Buffer.alloc(0)],
    ["too-big.txt", Buffer.alloc(60001, 65)],
  ] as [string, Buffer][]) {
    await file.setInputFiles({ name, mimeType: "text/plain", buffer });
    await expect(learner.getByRole("alert").first()).toBeVisible();
  }
  await file.setInputFiles({
    name: "long.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Я".repeat(29000)),
  });
  await learner.getByLabel("Ответ на задание 1").fill("5");
  await learner.getByRole("radio", { name: "0,75", exact: true }).check();
  await learner.getByLabel("Ответ на задание 3").fill("Пояснение ".repeat(600));
  await expect(learner.getByLabel("Ответ на задание 3")).toHaveJSProperty(
    "value",
    "Пояснение ".repeat(600).slice(0, 5000),
  );
  await expect(learner.getByRole("status")).toHaveText("Сохранено");
  learner.once("dialog", (d) => d.accept());
  await learner
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(
    learner.getByText("Файл: long.txt", { exact: true }),
  ).toBeVisible();
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await tutor
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await expect(
    tutor.getByText(/Работа слишком длинная для одной AI-проверки/),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    tutor.getByRole("button", { name: "Повторить AI-проверку", exact: true }),
  ).toHaveCount(0);
  await tutor
    .getByLabel("Комментарий к работе")
    .fill("Разделите работу на части. Исходный файл сохранён.");
  await tutor
    .getByRole("button", { name: "Вернуть на доработку", exact: true })
    .click();
  await expect(
    learner.getByRole("button", { name: "Отправить работу", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    learner.getByText("Файл: long.txt", { exact: true }),
  ).toBeVisible();
});

test("two learners submit concurrently and each report category handles validation and network loss", async ({
  context,
}) => {
  const a = await context.newPage(),
    b = await context.newPage(),
    tutor = await context.newPage();
  // The second demo persona has no separate login button: only the auth fixture URL is selected.
  await b.route("**/api/auth/demo/learner", (r) =>
    r.continue({ url: r.request().url() + "-2" }),
  );
  for (const [p, title, answer] of [
    [a, /Линейные уравнения: от шага к решению/, "5"],
    [b, /Дроби и уравнения: самостоятельная работа/, "9"],
  ] as const) {
    await p.goto("/");
    await p.getByRole("button", { name: "Я ученик", exact: true }).click();
    await p.getByRole("button", { name: title }).click();
    await p.getByLabel("Ответ на задание 1").fill(answer);
    await p.getByRole("radio", { name: "0,75", exact: true }).check();
    await p.getByLabel("Ответ на задание 3").fill("Сохраняем равенство");
    await expect(p.getByRole("status")).toHaveText("Сохранено");
    p.once("dialog", (d) => d.accept());
  }
  await Promise.all(
    [a, b].map((p) =>
      p.getByRole("button", { name: "Отправить работу", exact: true }).click(),
    ),
  );
  await expect(a.locator(".work-task .original p").first()).toHaveText("5");
  await expect(b.locator(".work-task .original p").first()).toHaveText("9");
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  for (const title of [
    /Линейные уравнения: от шага к решению/,
    /Дроби и уравнения: самостоятельная работа/,
  ]) {
    await tutor.getByRole("button", { name: /^Задания(?: \d+)?$/ }).click();
    await tutor.getByRole("button", { name: title }).click();
    await expect(
      tutor.getByRole("button", { name: "Подтвердить разбор", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await tutor
      .getByRole("button", { name: "Подтвердить разбор", exact: true })
      .click();
  }
  for (const category of [
    "useful",
    "incorrect_feedback",
    "harmful_feedback",
    "bug",
  ]) {
    await choose(
      a.getByRole("combobox", { name: "Тип отзыва", exact: true }),
      category,
    );
    await a.getByLabel("Комментарий к разбору").fill("");
    await a
      .getByRole("button", { name: "Отправить отзыв о разборе", exact: true })
      .click();
    await expect(
      a.getByText("Сообщение сохранено для разбора командой", { exact: true }),
    ).toBeVisible(); // Comment is optional for every category in the current product contract.
    await a.getByLabel("Комментарий к разбору").fill("Я".repeat(3000));
    expect(
      (await a.getByLabel("Комментарий к разбору").inputValue()).length,
    ).toBe(2000);
    await a
      .getByLabel("Комментарий к разбору")
      .fill("Проверка 🧪 <script> & Ё");
    await a.route("**/api/reports", (r) => r.abort());
    await a
      .getByRole("button", { name: "Отправить отзыв о разборе", exact: true })
      .click();
    await expect(a.getByRole("alert").first()).toBeVisible();
    await expect(a.getByLabel("Комментарий к разбору")).toHaveValue(
      "Проверка 🧪 <script> & Ё",
    );
    await a.unroute("**/api/reports");
    await a
      .getByRole("button", { name: "Отправить отзыв о разборе", exact: true })
      .click();
    await expect(
      a.getByText("Сообщение сохранено для разбора командой", { exact: true }),
    ).toBeVisible();
  }
});
