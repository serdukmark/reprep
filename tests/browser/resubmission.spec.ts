import { test, expect } from "@playwright/test";

test("return arrives without reload; resubmission starts from saved original and archive stays immutable", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  const title = "Повторная попытка " + Date.now();
  await tutor.getByRole("button", { name: "Создать задание" }).click();
  await tutor.getByLabel("Название работы").fill(title);
  await tutor.getByLabel("Ученик", { exact: true }).selectOption("demo-link");
  await tutor.getByLabel("Условие", { exact: true }).fill("Решите 3x + 7 = 22");
  await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await tutor.getByLabel("Навык", { exact: true }).fill("Уравнения");
  await tutor.getByRole("button", { name: "Назначить ученику" }).click();
  await expect(tutor.getByRole("heading", { name: title })).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await learner.getByLabel("Ответ на задание 1").fill("4");
  await learner.getByRole("button", { name: "Сохранить ответы" }).click();
  await expect(learner.getByRole("status")).toHaveText("Сохранено");
  learner.once("dialog", (d) => d.accept());
  await learner.getByRole("button", { name: "Отправить работу" }).click();
  await expect(learner.getByText("ОРИГИНАЛЬНЫЙ ОТВЕТ УЧЕНИКА")).toBeVisible();
  await tutor.reload();
  await tutor.getByRole("button", { name: new RegExp(title) }).click();
  await tutor
    .getByLabel("Комментарий к работе")
    .fill("Перепроверь вычитание 7.");
  await tutor.getByRole("button", { name: "Вернуть на доработку" }).click();
  await expect(learner.getByLabel("Ответ на задание 1")).toHaveValue("4", {
    timeout: 15000,
  });
  await learner.getByLabel("Ответ на задание 1").fill("5");
  await learner.getByRole("button", { name: "Сохранить ответы" }).click();
  await expect(learner.getByRole("status")).toHaveText("Сохранено");
  learner.once("dialog", (d) => d.accept());
  await learner.getByRole("button", { name: "Отправить работу" }).click();
  await expect(learner.getByText("ОРИГИНАЛЬНЫЙ ОТВЕТ УЧЕНИКА")).toBeVisible();
  await learner
    .getByRole("button", { name: "История попыток", exact: true })
    .click();
  await learner
    .locator(".attempt-history")
    .getByRole("button", { name: /Попытка 1/ })
    .click();
  await expect(learner.locator(".attempt-detail .original p")).toHaveText("4");
  await expect(learner.locator(".attempt-detail")).toContainText(
    "Перепроверь вычитание 7.",
  );
  await learner
    .locator(".attempt-history")
    .getByRole("button", { name: /Попытка 2/ })
    .click();
  await expect(learner.locator(".attempt-detail .original p")).toHaveText("5");
  await expect(tutor.locator(".work-task .original p")).toHaveText("5", {
    timeout: 15000,
  });
  await expect(tutor.getByLabel("Комментарий к работе")).toHaveValue("");
  await tutor
    .getByRole("button", { name: "Подтвердить разбор", exact: true })
    .click();
  await expect(
    learner.getByText("Проверено преподавателем", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await tutor.close();
  await learner.close();
});
