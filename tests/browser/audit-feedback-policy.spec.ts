import { test, expect, choose } from "./audit-fixtures";
for (const policy of ["after_review", "hints_first"])
  test(`feedback ${policy}: empty submit rejected, double submit immutable, hints and teacher feedback follow policy`, async ({
    browser,
  }) => {
    const tutor = await browser.newPage(),
      learner = await browser.newPage();
    await tutor.goto("/");
    await tutor
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await tutor
      .getByRole("button", { name: "Создать задание", exact: true })
      .click();
    const title = "Политика " + policy;
    await tutor.getByLabel("Название работы").fill(title);
    await choose(
      tutor.getByRole("combobox", { name: "Ученик", exact: true }),
      "demo-link",
    );
    await choose(
      tutor.getByRole("combobox", {
        name: "Когда показывать обратную связь",
        exact: true,
      }),
      policy,
    );
    await tutor.getByLabel("Условие", { exact: true }).fill("Сложите 20+22");
    await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("42");
    await tutor.getByLabel("Навык", { exact: true }).fill("Сложение");
    await tutor
      .getByLabel("Подсказка ученику (без готового ответа)")
      .fill("Сначала сложите десятки 🧪");
    await tutor
      .getByRole("button", { name: "Назначить ученику", exact: true })
      .click();
    await expect(
      tutor.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await learner.goto("/");
    await learner
      .getByRole("button", { name: "Я ученик", exact: true })
      .click();
    await learner.getByRole("button", { name: new RegExp(title) }).click();
    await expect(
      learner.getByText("Сначала сложите десятки 🧪", { exact: true }),
    ).toHaveCount(0);
    await expect(
      learner.getByLabel("Эталонный ответ", { exact: true }),
    ).toHaveCount(0);
    learner.on("dialog", (d) => d.accept());
    await learner
      .getByRole("button", { name: "Отправить работу", exact: true })
      .click();
    await expect(learner.getByRole("alert").first()).toBeVisible();
    await expect(learner.getByLabel("Ответ на задание 1")).toBeVisible();
    await learner.getByLabel("Ответ на задание 1").fill("41");
    await learner
      .getByRole("button", { name: "Отправить работу", exact: true })
      .dblclick();
    await expect(learner.locator(".work-task .original p")).toHaveText("41");
    await expect(learner.getByLabel("Ответ на задание 1")).toHaveCount(0);
    if (policy === "hints_first") {
      await learner
        .getByRole("button", { name: "Подсказка преподавателя", exact: true })
        .click();
      await expect(
        learner.getByText("Сначала сложите десятки 🧪", { exact: true }),
      ).toBeVisible();
    } else
      await expect(
        learner.getByRole("button", {
          name: "Подсказка преподавателя",
          exact: true,
        }),
      ).toHaveCount(0);
    await expect(learner.getByText("42", { exact: true })).toHaveCount(0);
    await expect(
      learner.getByText("Объяснение от преподавателя 🧪", { exact: true }),
    ).toHaveCount(0);
    await tutor.reload();
    await tutor.getByRole("button", { name: new RegExp(title) }).click();
    await choose(
      tutor.getByRole("combobox", { name: "Результат", exact: true }),
      "incorrect",
    );
    await tutor
      .getByLabel("Обратная связь ученику")
      .fill("Объяснение от преподавателя 🧪");
    await tutor
      .getByRole("button", { name: "Сохранить мою проверку", exact: true })
      .click();
    await expect(
      learner.getByText("Объяснение от преподавателя 🧪", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await learner.reload();
    await learner.getByRole("button", { name: new RegExp(title) }).click();
    await expect(learner.locator(".work-task .original p")).toHaveText("41");
    await expect(
      learner.getByText("Объяснение от преподавателя 🧪", { exact: true }),
    ).toBeVisible();
    await tutor.close();
    await learner.close();
  });
