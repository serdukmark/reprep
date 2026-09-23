import { test, expect, choose } from "./audit-fixtures";
for (const mode of ["UNAVAILABLE", "EMPTY", "GARBAGE", "SLOW"]) {
  test(`AI ${mode}: submission survives refresh and teacher reaches verified outcome`, async ({
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
    if (mode === "SLOW") {
      await expect(
        tutor.getByRole("button", { name: "Подтвердить разбор", exact: true }),
      ).toBeVisible({ timeout: 20000 });
      await tutor
        .getByRole("button", { name: "Подтвердить разбор", exact: true })
        .click();
    } else {
      await expect(
        tutor.getByText(/AI не смог подготовить надёжный разбор/),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        tutor.getByRole("button", { name: "Подтвердить разбор", exact: true }),
      ).toHaveCount(0);
      await choose(
        tutor.getByRole("combobox", { name: "Результат", exact: true }),
        "correct",
      );
      await tutor
        .getByLabel("Обратная связь ученику")
        .fill("Проверено вручную: 5 верно.");
      await tutor
        .getByRole("button", { name: "Сохранить мою проверку", exact: true })
        .click();
    }
    await expect(
      learner.getByText("Проверено преподавателем", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(learner.locator(".work-task .original p")).toHaveText("5");
    await tutor.close();
    await learner.close();
  });
}
