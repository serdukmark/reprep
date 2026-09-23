import { test, expect, choose } from "./audit-fixtures";
test("draft preview and task removal, concurrent teacher edits cannot overwrite each other", async ({
  context,
}) => {
  const a = await context.newPage(),
    b = await context.newPage();
  await a.goto("/");
  await a
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await a.getByRole("button", { name: "Создать задание", exact: true }).click();
  await a.getByLabel("Название работы").fill("Два редактора");
  await a.getByLabel("Условие", { exact: true }).fill("2+2?");
  await a.getByLabel("Эталонный ответ", { exact: true }).fill("4");
  await a.getByLabel("Навык", { exact: true }).fill("Сложение");
  await a
    .getByRole("button", { name: "Добавить задание", exact: true })
    .click();
  await expect(a.locator(".task-editor")).toHaveCount(2);
  await a
    .getByRole("button", { name: "Удалить задание 2", exact: true })
    .click();
  await expect(a.locator(".task-editor")).toHaveCount(1);
  await a.getByRole("button", { name: "Глазами ученика", exact: true }).click();
  await expect(a.getByLabel("Эталонный ответ", { exact: true })).toHaveCount(0);
  await expect(a.getByText("2+2?", { exact: true })).toBeVisible();
  await a
    .getByRole("button", { name: "Вернуться к редактору", exact: true })
    .click();
  await a
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    a.getByRole("heading", { name: "Два редактора", exact: true }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Редактировать", exact: true }).click();
  await b.goto("/");
  await b
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await b.getByRole("button", { name: "Задания", exact: true }).click();
  await b.locator(".assignment-row").click();
  await b.getByRole("button", { name: "Редактировать", exact: true }).click();
  await a.getByLabel("Инструкция ученику").fill("Первое сохранение");
  await a
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    a.getByRole("heading", { name: "Два редактора", exact: true }),
  ).toBeVisible();
  await b.getByLabel("Инструкция ученику").fill("Второе сохранение");
  await b
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(b.getByRole("alert")).toBeVisible();
  await expect(b.getByLabel("Инструкция ученику")).toHaveValue(
    "Второе сохранение",
  );
  b.once("dialog", (d) => d.accept());
  await b.reload();
  await b.getByRole("button", { name: "Задания", exact: true }).click();
  await b.locator(".assignment-row").click();
  await b.getByRole("button", { name: "Редактировать", exact: true }).click();
  await expect(b.getByLabel("Инструкция ученику")).toHaveValue(
    "Первое сохранение",
  );
});

test("group editing changes title and membership, bulk double click creates one copy per member", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByLabel("Название группы").fill("Исходная группа");
  await page.getByRole("checkbox", { name: /Саша • демо/ }).check();
  await page.getByRole("checkbox", { name: /Женя • демо/ }).check();
  await page
    .getByRole("button", { name: "Сохранить группу", exact: true })
    .click();
  await expect(
    page.getByText("Группа сохранена", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Изменить состав", exact: true })
    .click();
  await page.getByLabel("Название группы").fill("Изменённая группа 🧪");
  await page.getByRole("checkbox", { name: /Женя • демо/ }).uncheck();
  await page
    .getByRole("button", { name: "Сохранить группу", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Изменённая группа 🧪", exact: true }),
  ).toBeVisible();
  const group = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Изменённая группа 🧪",
        exact: true,
      }),
    });
  await expect(group).not.toContainText("Женя");
  await choose(
    group.getByRole("combobox", {
      name: "Работа для группы Изменённая группа 🧪",
      exact: true,
    }),
    "demo-assignment",
  );
  let writes = 0;
  page.on("request", (r) => {
    if (r.url().match(/\/groups\/[^/]+\/assign$/) && r.method() === "POST")
      writes++;
  });
  await group
    .getByRole("button", {
      name: "Назначить работу всем 1 участникам",
      exact: true,
    })
    .dblclick();
  await expect(
    page.getByText("Создано записей для участников: 1", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await expect(page.locator(".assignment-row")).toHaveCount(3);
});
