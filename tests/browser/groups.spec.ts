import { test, expect, choose } from "./audit-fixtures";

test("tutor creates group, assigns copies, and learner receives only own assignment", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor.getByRole("button", { name: "Ученики", exact: true }).click();
  await tutor.getByLabel("Название группы").fill("Совместная практика");
  await tutor.getByRole("checkbox", { name: /Саша • демо/ }).check();
  await tutor.getByRole("checkbox", { name: /Женя • демо/ }).check();
  await tutor
    .getByRole("button", { name: "Сохранить группу", exact: true })
    .click();
  await expect(
    tutor.getByText("Группа сохранена", { exact: true }),
  ).toBeVisible();
  const group = tutor.locator("article").filter({
    has: tutor.getByRole("heading", {
      name: "Совместная практика",
      exact: true,
    }),
  });
  await choose(
    group.getByRole("combobox", {
      name: "Работа для группы Совместная практика",
      exact: true,
    }),
    "demo-assignment",
  );
  await group
    .getByRole("button", {
      name: "Назначить работу всем 2 участникам",
      exact: true,
    })
    .click();
  await expect(
    tutor.getByText("Создано записей для участников: 2", { exact: true }),
  ).toBeVisible();
  await group.getByLabel("Тема общего занятия").fill("Совместный разбор");
  await group.getByLabel("Начало общего занятия").fill("2026-09-27T16:00");
  await tutor.route("**/api/groups/*/lessons", async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    await route.abort();
  });
  await group
    .getByRole("button", {
      name: "Запланировать для всех 2 участников",
      exact: true,
    })
    .click();
  await expect(tutor.getByRole("alert")).toBeVisible();
  await tutor.unroute("**/api/groups/*/lessons");
  await group
    .getByRole("button", {
      name: "Запланировать для всех 2 участников",
      exact: true,
    })
    .dblclick();
  await expect(
    tutor.getByText("Создано записей для участников: 2", { exact: true }),
  ).toBeVisible();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner
    .getByRole("button", { name: "Расписание", exact: true })
    .click();
  await expect(
    learner.getByRole("heading", { name: "Совместный разбор", exact: true }),
  ).toHaveCount(1);
  await expect(learner.getByText("Женя • демо", { exact: true })).toHaveCount(
    0,
  );
  await tutor.close();
  await learner.close();
});
