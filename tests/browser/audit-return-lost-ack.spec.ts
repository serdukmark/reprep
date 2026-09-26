import { test, expect, choose } from "./audit-fixtures";
test("returned work resubmitted with lost acknowledgement keeps two immutable attempts and one confirmed progress result", async ({
  context,
}) => {
  const learner = await context.newPage(),
    tutor = await context.newPage();
  const title = /Линейные уравнения: от шага к решению/;
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner.getByRole("button", { name: title }).click();
  await learner.getByLabel("Ответ на задание 1").fill("4");
  await learner.getByRole("radio", { name: "0,75", exact: true }).check();
  await learner.getByLabel("Ответ на задание 3").fill("Первое объяснение 🧪");
  await expect(learner.getByRole("status")).toHaveText("Сохранено");
  learner.on("dialog", (d) => d.accept());
  await learner
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(learner.locator(".work-task .original p").first()).toHaveText(
    "4",
  );
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await tutor.getByRole("button", { name: title }).click();
  await tutor
    .getByLabel("Комментарий к работе")
    .fill("Проверьте деление и поясните шаг 🧪");
  await tutor
    .getByRole("button", { name: "Вернуть на доработку", exact: true })
    .click();
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue("4", {
    timeout: 15000,
  });
  await learner.reload();
  await learner.getByRole("button", { name: title }).click();
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue("4");
  await learner.getByLabel("Ответ на задание 1").fill("5");
  await learner
    .getByLabel("Ответ на задание 3")
    .fill("Новое объяснение: одинаковые действия 🧪");
  await expect(learner.getByRole("status")).toHaveText("Сохранено");
  let committed = 0;
  await learner.route(
    "**/api/assignments/demo-assignment/submit",
    async (r) => {
      const response = await r.fetch();
      expect(response.ok()).toBe(true);
      committed++;
      await r.abort("connectionreset");
    },
  );
  await learner
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(learner.getByRole("alert").first()).toBeVisible();
  expect(committed).toBe(1);
  await learner.unroute("**/api/assignments/demo-assignment/submit");
  await learner.reload();
  await learner.getByRole("button", { name: title }).click();
  await expect(learner.locator(".work-task .original p").first()).toHaveText(
    "5",
  );
  await learner
    .getByRole("button", { name: "История попыток", exact: true })
    .click();
  const history = learner.locator(".attempt-history");
  await expect(history.getByRole("button", { name: /Попытка \d/ })).toHaveCount(
    2,
  );
  await history.getByRole("button", { name: /Попытка 1/ }).click();
  await expect(
    learner.locator(".attempt-detail .original p").first(),
  ).toHaveText("4");
  await history.getByRole("button", { name: /Попытка 2/ }).click();
  await expect(
    learner.locator(".attempt-detail .original p").first(),
  ).toHaveText("5");
  await tutor.reload();
  await tutor.getByRole("button", { name: title }).click();
  await expect(
    tutor.getByRole("combobox", { name: "Результат", exact: true }),
  ).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await choose(
      tutor.getByRole("combobox", { name: "Результат", exact: true }).nth(i),
      "correct",
    );
    await tutor
      .getByRole("textbox", { name: /^Обратная связь ученику/ })
      .nth(i)
      .fill("Проверена вторая попытка 🧪");
  }
  await tutor
    .getByRole("button", { name: "Сохранить мою проверку", exact: true })
    .click();
  await expect(
    tutor.getByText("Проверено преподавателем", { exact: true }).first(),
  ).toBeVisible();
  await learner.reload();
  await learner.getByRole("button", { name: title }).click();
  await expect(
    learner.getByText("Проверена вторая попытка 🧪", { exact: true }),
  ).toHaveCount(3);
  await learner
    .getByRole("button", { name: "Мой прогресс", exact: true })
    .click();
  await expect(
    learner.getByText("1 проверенных ответов · 1 верных", { exact: true }),
  ).toHaveCount(3);
});
