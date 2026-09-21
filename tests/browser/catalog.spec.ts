import { test, expect } from "@playwright/test";

test("catalog tutor offer leads to learner request and accepted study relationship", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await tutor.getByRole("button", { name: "Репетиторы", exact: true }).click();
  await tutor
    .getByLabel("Заголовок анкеты")
    .fill("Физика через понятные задачи");
  await tutor
    .getByLabel("О занятиях", { exact: true })
    .fill("Синтетическая анкета преподавателя для технического демо.");
  await tutor
    .getByLabel("Предметы анкеты (каждый с новой строки)")
    .fill("Физика");
  await tutor.getByLabel("Показывать мою анкету в каталоге").check();
  await tutor
    .getByRole("button", { name: "Сохранить анкету", exact: true })
    .click();
  await expect(tutor.getByRole("status")).toHaveText("Анкета сохранена");
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик", exact: true }).click();
  await learner
    .getByRole("button", { name: "Репетиторы", exact: true })
    .click();
  await learner.getByLabel("Предмет или имя").fill("ФИЗИКА");
  await expect(
    learner.getByRole("heading", { name: "Физика через понятные задачи" }),
  ).toBeVisible();
  await learner.getByRole("button", { name: "Оставить заявку" }).click();
  await learner
    .getByLabel("Что хотите изучать")
    .fill("Хочу разобрать движение тела.");
  await learner
    .getByRole("button", { name: "Отправить заявку", exact: true })
    .click();
  await expect(
    learner.getByText("Ожидает решения преподавателя"),
  ).toBeVisible();
  await expect(
    tutor.getByRole("button", { name: "Принять ученика", exact: true }),
  ).toBeVisible();
  await tutor
    .getByLabel("Ответ на заявку")
    .fill("Начнём с задачи на скорость.");
  await tutor
    .getByRole("button", { name: "Принять ученика", exact: true })
    .click();
  await expect(
    learner.getByText("Преподаватель принял заявку. Учебная связь создана."),
  ).toBeVisible();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await expect(
    tutor.getByRole("button", { name: /Саша • демо Физика/ }),
  ).toBeVisible();
  await tutor.close();
  await learner.close();
});
