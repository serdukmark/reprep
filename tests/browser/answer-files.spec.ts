import { test, expect } from "@playwright/test";

test("pupil TXT survives autosave, submission and tutor return without rewriting history", async ({
  browser,
}) => {
  const learner = await browser.newPage(),
    tutor = await browser.newPage();
  learner.on("dialog", (d) => d.accept());
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  const text = "  Решение: 3x = 15\nx = 5\n";
  await learner
    .getByLabel("TXT к заданию 1")
    .setInputFiles({
      name: "solution.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
  await learner.getByRole("radio", { name: "0,75", exact: true }).check();
  await learner
    .getByLabel("Ответ на задание 3")
    .fill("Одинаковое вычитание сохраняет равенство.");
  await expect(learner.getByRole("status")).toHaveText("Сохранено");
  await learner.reload();
  await learner
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await learner.getByText("Файл: solution.txt", { exact: true }).click();
  await expect(learner.locator("pre")).toHaveText(text);
  await learner
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(
    learner.getByRole("button", { name: "Отправить работу", exact: true }),
  ).toHaveCount(0);
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await tutor.getByText("Файл: solution.txt", { exact: true }).click();
  await expect(tutor.locator("pre")).toHaveText(text);
  await tutor.getByLabel("Комментарий к работе").fill("Дополните пояснение");
  await tutor.getByRole("button", { name: "Вернуть на доработку" }).click();
  await expect(
    learner.getByRole("button", { name: "Отправить работу", exact: true }),
  ).toBeVisible();
  await learner.getByRole("button", { name: "Убрать файл" }).click();
  await learner.getByLabel("Ответ на задание 1").fill("5");
  await learner
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await learner
    .getByRole("button", { name: "История попыток", exact: true })
    .click();
  await learner.getByRole("button", { name: /Попытка 1/ }).click();
  await learner.getByText("Файл: solution.txt", { exact: true }).click();
  await expect(learner.locator(".attempt-detail pre")).toHaveText(text);
  await learner.close();
  await tutor.close();
});
