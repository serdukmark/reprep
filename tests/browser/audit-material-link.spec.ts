import { test, expect, choose } from "./audit-fixtures";
test("material linked to lesson appears in the assigned work and keeps its explanatory note in library", async ({
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
  await tutor.getByLabel("Название работы").fill("Работа с материалом занятия");
  await choose(
    tutor.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  await choose(
    tutor.getByRole("combobox", {
      name: "Занятие для этой работы",
      exact: true,
    }),
    { index: 1 },
  );
  await tutor.getByLabel("Условие", { exact: true }).fill("2+3?");
  await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await tutor.getByLabel("Навык", { exact: true }).fill("Сложение");
  await tutor
    .getByRole("button", { name: "Назначить ученику", exact: true })
    .click();
  await expect(
    tutor.getByRole("heading", {
      name: "Работа с материалом занятия",
      exact: true,
    }),
  ).toBeVisible();
  await tutor.getByRole("button", { name: "Материалы", exact: true }).click();
  await tutor
    .getByRole("button", { name: "Добавить материал", exact: true })
    .click();
  await tutor.getByLabel("Название", { exact: true }).fill("Ссылка занятия");
  await choose(
    tutor.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  await choose(tutor.getByRole("combobox", { name: "Занятие", exact: true }), {
    index: 1,
  });
  await tutor.getByLabel("Ссылка HTTPS").fill("https://example.org/lesson");
  await tutor
    .getByLabel("Пояснение", { exact: true })
    .fill("Разберите пример 🧪 <текст>");
  await tutor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    tutor.getByRole("heading", { name: "Ссылка занятия", exact: true }),
  ).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner
    .getByRole("button", { name: /Работа с материалом занятия/ })
    .click();
  const material = learner
    .locator("section")
    .filter({
      has: learner.getByRole("heading", {
        name: "Материалы к работе",
        exact: true,
      }),
    });
  await expect(
    material.getByText("Ссылка занятия", { exact: true }),
  ).toBeVisible();
  await expect(
    material.getByRole("link", { name: "Открыть материал", exact: true }),
  ).toHaveAttribute("href", "https://example.org/lesson");
  await learner.getByRole("button", { name: "Материалы", exact: true }).click();
  await expect(
    learner.getByText("Разберите пример 🧪 <текст>", { exact: true }),
  ).toBeVisible();
  await tutor.close();
  await learner.close();
});
