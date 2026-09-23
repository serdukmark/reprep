import { test, expect, choose } from "./audit-fixtures";

test("tutor defines acyclic skill links and learner can inspect saved graph", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor.getByRole("button", { name: /Саша • демо/ }).click();
  await tutor
    .getByLabel("Навыки графа (каждый с новой строки)")
    .fill("Линейные уравнения\nСледующий навык");
  await choose(
    tutor.getByRole("combobox", { name: "Сначала навык", exact: true }),
    "Линейные уравнения",
  );
  await choose(
    tutor.getByRole("combobox", { name: "Затем навык", exact: true }),
    "Следующий навык",
  );
  await tutor
    .getByRole("button", { name: "Добавить связь", exact: true })
    .click();
  await tutor
    .getByRole("button", { name: "Сохранить граф", exact: true })
    .click();
  await expect(tutor.getByText("Граф сохранён", { exact: true })).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner
    .getByRole("button", { name: "Мой прогресс", exact: true })
    .click();
  await learner.getByRole("button", { name: /Навык Следующий навык:/ }).click();
  await expect(
    learner.getByText(/Не все предпосылки подтверждены последней проверкой/),
  ).toBeVisible();
  await expect(
    learner.getByRole("button", { name: "Сохранить граф", exact: true }),
  ).toHaveCount(0);
  await tutor.getByRole("button", { name: /Алекс • демо/ }).click();
  await expect(tutor.getByText(/Медиана ожидания решения:/)).toBeVisible();
  await tutor.close();
  await learner.close();
});
