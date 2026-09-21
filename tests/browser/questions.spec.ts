import { test, expect } from "@playwright/test";

test("question remains visible on AI outage and teacher can reply without losing it", async ({
  browser,
}) => {
  const learner = await browser.newPage(),
    tutor = await browser.newPage();
  const title = /Линейные уравнения: от шага к решению/;
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner.getByRole("button", { name: title }).click();
  await expect(
    learner.getByRole("heading", {
      name: "Вопрос по заданию для AI и преподавателя",
      exact: true,
    }),
  ).toHaveCount(1);
  await learner
    .getByLabel("Вопрос к AI", { exact: true })
    .fill("Почему можно вычитать одно и то же число?");
  await learner
    .getByRole("button", { name: "Задать вопрос", exact: true })
    .click();
  await expect(
    learner.getByText("AI не смог ответить. Ответит преподаватель.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    learner.getByText("Почему можно вычитать одно и то же число?", {
      exact: true,
    }),
  ).toBeVisible();
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor.getByRole("button", { name: "Задания", exact: true }).click();
  await tutor.getByRole("button", { name: title }).click();
  await tutor
    .getByLabel("Ответ преподавателя на вопрос")
    .fill("Одинаковое вычитание сохраняет равенство двух величин.");
  await tutor
    .getByRole("button", { name: "Подтвердить и отправить ответ", exact: true })
    .click();
  await expect(
    learner.getByText(
      "Ответ проверен преподавателем: Одинаковое вычитание сохраняет равенство двух величин.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    learner.getByText("Предварительный ответ · AI недоступен", { exact: true }),
  ).toHaveCount(0);
  await learner.close();
  await tutor.close();
});
