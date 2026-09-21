import { test, expect } from "@playwright/test";

test("teacher plan is readable by pupil, and assignment discussion survives reload", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor.getByRole("button", { name: /Саша • демо/ }).click();
  await tutor.getByLabel("Цель программы").fill("Научиться решать уравнения");
  await tutor.getByLabel("Учебный уровень").fill("Базовый");
  await tutor
    .getByRole("button", { name: "Добавить этап", exact: true })
    .click();
  await tutor
    .getByLabel("Этап 1", { exact: true })
    .fill("Проверка равносильности");
  await tutor.getByLabel("Навык этапа 1", { exact: true }).fill("Уравнения");
  await tutor
    .getByRole("combobox", { name: "Работа этапа 1", exact: true })
    .selectOption("demo-assignment");
  await tutor.getByRole("button", { name: "Сохранить программу" }).click();
  await expect(tutor.getByText("Программа сохранена")).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner.getByRole("button", { name: "Прогресс", exact: true }).click();
  await expect(learner.getByText("Научиться решать уравнения")).toBeVisible();
  await expect(
    learner.getByRole("button", { name: "Сохранить программу" }),
  ).toHaveCount(0);
  await learner
    .getByRole("button", { name: "Открыть работу", exact: true })
    .click();
  await learner
    .getByLabel("Сообщение по заданию")
    .fill("Как проверить равносильность?");
  await learner.getByRole("button", { name: "Отправить сообщение" }).click();
  await expect(
    learner.getByText("Как проверить равносильность?", { exact: true }),
  ).toBeVisible();
  await tutor.getByRole("button", { name: "Задания", exact: true }).click();
  await tutor
    .getByText("Линейные уравнения: от шага к решению", { exact: true })
    .first()
    .click();
  await expect(
    tutor.getByText("Как проверить равносильность?", { exact: true }),
  ).toBeVisible();
  await tutor
    .getByLabel("Сообщение по заданию")
    .fill("Выполните одинаковое действие с обеими частями.");
  await tutor.getByRole("button", { name: "Отправить сообщение" }).click();
  await expect(
    learner.getByText("Выполните одинаковое действие с обеими частями.", {
      exact: true,
    }),
  ).toBeVisible();
  await tutor.close();
  await learner.close();
});
