import { test, expect, choose } from "./audit-fixtures";
for (const failure of ["network failure", "lost acknowledgement", "expired session"])
  test(`teacher review with ${failure} remains truthful and reaches learner once`, async ({
    browser,
  }) => {
    const committed = failure === "lost acknowledgement";
    const tutor = await browser.newPage(),
      learner = await browser.newPage();
    await tutor.goto("/");
    await tutor
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await tutor
      .getByRole("button", { name: "Создать задание", exact: true })
      .click();
    const title = "Проверка доставки решения " + failure;
    await tutor.getByLabel("Название работы").fill(title);
    await choose(
      tutor.getByRole("combobox", { name: "Ученик", exact: true }),
      "demo-link",
    );
    await tutor.getByLabel("Условие", { exact: true }).fill("Сложите 2+3");
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
    learner.on("dialog", (d) => d.accept());
    await learner
      .getByRole("button", { name: "Отправить работу", exact: true })
      .click();
    await expect(learner.locator(".work-task .original p")).toHaveText("5");
    await tutor.reload();
    await tutor.getByRole("button", { name: new RegExp(title) }).click();
    await choose(
      tutor.getByRole("combobox", { name: "Результат", exact: true }),
      "correct",
    );
    const answer = "Решение подтверждено 🧪";
    await tutor.getByLabel("Обратная связь ученику").fill(answer);
    if (failure === "expired session") {
      expect(await tutor.evaluate(async () => (await fetch("/api/logout", {
        method: "POST", headers: {Authorization: "Bearer " + sessionStorage.getItem("reprep.session")}
      })).status)).toBe(200);
      await tutor.getByRole("button", {name: "Сохранить мою проверку", exact: true}).click();
      await expect(tutor.getByRole("alert").first()).toBeVisible();
      await expect(tutor.getByLabel("Обратная связь ученику")).toHaveValue(answer);
      await learner.reload();
      await learner.getByRole("button", {name: new RegExp(title)}).click();
      await expect(learner.getByText(answer, {exact: true})).toHaveCount(0);
      await tutor.reload();
      await tutor.getByRole("button", {name: "Я преподаватель", exact: true}).click();
      await tutor.getByRole("button", {name: new RegExp(title)}).click();
      await expect(tutor.getByRole("button", {name: "Сохранить мою проверку", exact: true})).toBeVisible();
      await tutor.getByLabel("Обратная связь ученику").fill(answer);
      await tutor.getByRole("button", {name: "Сохранить мою проверку", exact: true}).click();
      await expect(learner.getByText(answer, {exact: true})).toBeVisible({timeout: 15000});
      await tutor.close(); await learner.close(); return;
    }
    await tutor.route("**/api/submissions/*/review", async (route) => {
      if (committed) expect((await route.fetch()).ok()).toBeTruthy();
      await route.abort();
    });
    await tutor
      .getByRole("button", { name: "Сохранить мою проверку", exact: true })
      .click();
    await expect(tutor.getByRole("alert").first()).toBeVisible();
    if (!committed) {
      await expect(tutor.getByLabel("Обратная связь ученику")).toHaveValue(
        answer,
      );
      await expect(learner.getByText(answer, { exact: true })).toHaveCount(0);
    }
    await tutor.unroute("**/api/submissions/*/review");
    if (!committed)
      await tutor
        .getByRole("button", { name: "Сохранить мою проверку", exact: true })
        .dblclick();
    await expect(learner.getByText(answer, { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await learner.reload();
    await learner.getByRole("button", { name: new RegExp(title) }).click();
    await expect(learner.getByText(answer, { exact: true })).toHaveCount(1);
    await expect(learner.locator(".work-task .original p")).toHaveText("5");
    await learner
      .getByRole("button", { name: "Мой прогресс", exact: true })
      .click();
    await expect(
      learner.getByText("Сложение", { exact: true }).first(),
    ).toBeVisible();
    await tutor.close();
    await learner.close();
  });
