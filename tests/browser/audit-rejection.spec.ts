import { test, expect, choose } from "./audit-fixtures";
for (const mode of ["REJECT"]) {
  test(`AUD-004 rejected work shows teacher reason and does not create progress`, async ({
    context,
  }) => {
    const tutor = await context.newPage(),
      learner = await context.newPage();
    await tutor.goto("/");
    await tutor
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await tutor
      .getByRole("button", { name: "Создать задание", exact: true })
      .click();
    const title = `Проверка ${mode}`;
    await tutor.getByLabel("Название работы").fill(title);
    await choose(
      tutor.getByRole("combobox", { name: "Ученик", exact: true }),
      "demo-link",
    );
    await tutor.getByLabel("Инструкция ученику").fill(`AUD_AI_${mode}`);
    await tutor
      .getByLabel("Условие", { exact: true })
      .fill("Сколько будет 2 + 3?");
    await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("5");
    await tutor.getByLabel("Навык", { exact: true }).fill("Сложение");
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
    await learner.getByLabel("Ответ на задание 1").fill("5");
    learner.once("dialog", (d) => d.accept());
    await learner
      .getByRole("button", { name: "Отправить работу", exact: true })
      .click();
    await expect(learner.locator(".work-task .original p")).toHaveText("5");
    await learner.reload();
    await learner.getByRole("button", { name: new RegExp(title) }).click();
    await expect(learner.locator(".work-task .original p")).toHaveText("5");
    await tutor.reload();
    await tutor.getByRole("button", { name: new RegExp(title) }).click();
    await expect(
      tutor.getByRole("button", {
        name: "Отклонить без прогресса",
        exact: true,
      }),
    ).toBeDisabled();
    await tutor
      .getByLabel("Комментарий к работе")
      .fill("Не оцениваю: решите другой вариант 🧪.");
    await tutor
      .getByRole("button", { name: "Отклонить без прогресса", exact: true })
      .click();
    await expect(learner.locator(".notice")).toContainText(
      "Не оцениваю: решите другой вариант 🧪.",
      { timeout: 15000 },
    );
    await expect(learner.locator(".notice")).toContainText("без оценки");
    await expect(learner.locator(".reviewed-feedback")).toHaveCount(0);
    await learner.reload();
    await learner.getByRole("button", { name: new RegExp(title) }).click();
    await expect(learner.locator(".notice")).toContainText(
      "Не оцениваю: решите другой вариант 🧪.",
    );
    await learner
      .getByRole("button", { name: "Мой прогресс", exact: true })
      .click();
    await expect(learner.getByText("Сложение", { exact: true })).toHaveCount(0);
    await tutor.close();
    await learner.close();
  });
}
