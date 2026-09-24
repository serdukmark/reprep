import { test, expect, choose } from "./audit-fixtures";
test("plan stages reorder, remove, change status, link material and preserve concurrent edits", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    other = await browser.newPage(),
    learner = await browser.newPage();
  const open = async (p: typeof tutor) => {
    await p.getByRole("button", { name: "Ученики", exact: true }).click();
    await p.getByRole("button", { name: /Саша • демо/ }).click();
  };
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await tutor.getByRole("button", { name: "Материалы", exact: true }).click();
  await tutor
    .getByRole("button", { name: "Добавить материал", exact: true })
    .click();
  await tutor
    .getByLabel("Название", { exact: true })
    .fill("Материал программы 🧪");
  await choose(
    tutor.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  await tutor.getByLabel("Ссылка HTTPS").fill("https://example.org/plan");
  await tutor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    tutor.getByRole("heading", { name: "Материал программы 🧪", exact: true }),
  ).toBeVisible();
  await open(tutor);
  await tutor.getByLabel("Цель программы").fill("Цель программы 🧪 <текст>");
  for (let i = 1; i <= 2; i++) {
    await tutor
      .getByRole("button", { name: "Добавить этап", exact: true })
      .click();
    await tutor
      .getByLabel("Этап " + i, { exact: true })
      .fill("Этап номер " + i);
    await tutor
      .getByLabel("Навык этапа " + i, { exact: true })
      .fill("Сложение");
  }
  await tutor.getByRole("button", { name: "Выше", exact: true }).click();
  await expect(tutor.getByLabel("Этап 1", { exact: true })).toHaveValue(
    "Этап номер 2",
  );
  await tutor
    .getByRole("button", { name: "Удалить этап 2", exact: true })
    .click();
  await choose(
    tutor.getByRole("combobox", { name: "Статус этапа 1", exact: true }),
    "in_progress",
  );
  await choose(
    tutor.getByRole("combobox", { name: "Материал этапа 1", exact: true }),
    { index: 1 },
  );
  await choose(
    tutor.getByRole("combobox", { name: "Работа этапа 1", exact: true }),
    "demo-assignment",
  );
  await tutor
    .getByRole("button", { name: "Сохранить программу", exact: true })
    .click();
  await expect(
    tutor.getByText("Программа сохранена", { exact: true }),
  ).toBeVisible();
  await other.goto("/");
  await other
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await open(other);
  await expect(other.getByLabel("Цель программы")).toHaveValue(
    "Цель программы 🧪 <текст>",
  );
  await choose(
    tutor.getByRole("combobox", { name: "Статус этапа 1", exact: true }),
    "completed",
  );
  await tutor
    .getByRole("button", { name: "Сохранить программу", exact: true })
    .click();
  await expect(
    tutor.getByText("Программа сохранена", { exact: true }),
  ).toBeVisible();
  await other.getByLabel("Цель программы").fill("Запоздавшее изменение");
  await other
    .getByRole("button", { name: "Сохранить программу", exact: true })
    .click();
  await expect(other.getByRole("alert")).toBeVisible();
  await expect(other.getByLabel("Цель программы")).toHaveValue(
    "Запоздавшее изменение",
  );
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner
    .getByRole("button", { name: "Мой прогресс", exact: true })
    .click();
  await expect(
    learner.getByText("Цель программы 🧪 <текст>", { exact: true }),
  ).toBeVisible();
  await expect(
    learner.getByText("Сложение · Завершён преподавателем", { exact: true }),
  ).toBeVisible();
  await expect(
    learner.getByText("Материал: Материал программы 🧪", { exact: true }),
  ).toBeVisible();
  await expect(
    learner.getByRole("button", { name: "Сохранить программу", exact: true }),
  ).toHaveCount(0);
  await learner
    .getByRole("button", { name: "Открыть работу", exact: true })
    .click();
  await expect(learner.getByLabel("Ответ на задание 1")).toBeVisible();
  await tutor.close();
  await other.close();
  await learner.close();
});
