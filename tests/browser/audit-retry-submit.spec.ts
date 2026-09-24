import { test, expect, choose } from "./audit-fixtures";
test("cancel submission preserves draft; AI retries stop honestly at limit and manual review remains available", async ({
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
  const title = "Отмена и повтор AI";
  await tutor.getByLabel("Название работы").fill(title);
  await choose(
    tutor.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  await tutor.getByLabel("Инструкция ученику").fill("AUD_AI_UNAVAILABLE");
  await tutor.getByLabel("Условие", { exact: true }).fill("2+3?");
  await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await tutor.getByLabel("Навык", { exact: true }).fill("Сложение");
  await tutor
    .getByRole("button", { name: "Назначить ученику", exact: true })
    .click();
  await expect(
    tutor.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await learner.getByLabel("Ответ на задание 1").fill("5");
  learner.once("dialog", (d) => d.dismiss());
  await learner
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue("5");
  await expect(learner.locator(".work-task .original")).toHaveCount(0);
  learner.once("dialog", (d) => d.accept());
  await learner
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(learner.locator(".work-task .original p")).toHaveText("5");
  await tutor.reload();
  await tutor.getByRole("button", { name: new RegExp(title) }).click();
  const retry = tutor.getByRole("button", {
    name: "Повторить AI-проверку",
    exact: true,
  });
  for (let i = 0; i < 2; i++) {
    await expect(retry).toBeVisible({ timeout: 15000 });
    const response = tutor.waitForResponse(
      (r) => r.url().endsWith("/retry") && r.request().method() === "POST",
    );
    await retry.click();
    expect((await response).status()).toBe(200);
    await expect(retry).toHaveCount(0);
    await expect(tutor.locator(".work-task .original p")).toHaveText("5");
  }
  await expect(retry).toBeVisible({ timeout: 15000 });
  await retry.click();
  await expect(tutor.getByRole("alert")).toContainText(
    "Повторная проверка сейчас недоступна",
  );
  await expect(tutor.locator(".work-task .original p")).toHaveText("5");
  await choose(
    tutor.getByRole("combobox", { name: "Результат", exact: true }),
    "correct",
  );
  await tutor
    .getByLabel("Обратная связь ученику")
    .fill("Проверено вручную после повторов.");
  await tutor
    .getByRole("button", { name: "Сохранить мою проверку", exact: true })
    .click();
  await expect(
    learner.getByText("Проверено вручную после повторов.", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await tutor.close();
  await learner.close();
});
