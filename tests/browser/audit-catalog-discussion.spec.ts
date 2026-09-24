import { test, expect } from "./audit-fixtures";

test("catalog filters, lost committed request, decline and unpublish are visible to learner", async ({
  browser,
}) => {
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor
    .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
    .click();
  await tutor.getByRole("button", { name: "Репетиторы", exact: true }).click();
  const title = "Физика 🧪 <без HTML>";
  await tutor.getByLabel("Заголовок анкеты").fill(title);
  await tutor
    .getByLabel("О занятиях", { exact: true })
    .fill("Синтетическая анкета, разбираем задачи вместе.");
  await tutor
    .getByLabel("Предметы анкеты (каждый с новой строки)")
    .fill("Физика");
  await tutor.getByLabel("Стоимость занятия, руб.").fill("700");
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
    learner.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await learner.getByLabel("Максимальная цена, руб.").fill("699");
  await expect(learner.getByText("Подходящих анкет пока нет.")).toBeVisible();
  await learner.getByLabel("Максимальная цена, руб.").fill("700");
  await learner
    .getByRole("button", { name: "Оставить заявку", exact: true })
    .click();
  await learner
    .getByRole("button", { name: "Отправить заявку", exact: true })
    .click();
  expect(
    await learner
      .getByLabel("Что хотите изучать")
      .evaluate((el: HTMLTextAreaElement) => el.validity.valueMissing),
  ).toBeTruthy();
  const message = "Хочу понять движение 🧪 <script>текст</script>";
  await learner.getByLabel("Что хотите изучать").fill(message);
  await learner.route("**/api/catalog/*/requests", async (route) => {
    if (route.request().method() === "POST") {
      expect((await route.fetch()).ok()).toBeTruthy();
      await route.abort();
    } else await route.continue();
  });
  await learner
    .getByRole("button", { name: "Отправить заявку", exact: true })
    .click();
  await expect(learner.getByRole("alert")).toBeVisible();
  await expect(learner.getByLabel("Что хотите изучать")).toHaveValue(message);
  await learner.unroute("**/api/catalog/*/requests");
  await learner
    .getByRole("button", { name: "Отправить заявку", exact: true })
    .click();
  await expect(
    learner.getByText("Ожидает решения преподавателя", { exact: true }),
  ).toHaveCount(1);
  await expect(
    tutor.getByRole("button", { name: "Отклонить заявку", exact: true }),
  ).toBeVisible();
  await tutor
    .getByLabel("Ответ на заявку")
    .fill("Пока нет свободного времени 🧪");
  await tutor
    .getByRole("button", { name: "Отклонить заявку", exact: true })
    .click();
  await expect(
    learner.getByText("Преподаватель отклонил заявку.", { exact: true }),
  ).toBeVisible();
  await expect(
    learner.getByText("Ответ преподавателя: Пока нет свободного времени 🧪", {
      exact: true,
    }),
  ).toBeVisible();
  await tutor.getByLabel("Показывать мою анкету в каталоге").uncheck();
  await tutor
    .getByRole("button", { name: "Сохранить анкету", exact: true })
    .click();
  await expect(
    learner.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
  await learner.reload();
  await learner
    .getByRole("button", { name: "Репетиторы", exact: true })
    .click();
  await expect(
    learner.getByText("Преподаватель отклонил заявку.", { exact: true }),
  ).toHaveCount(1);
  await tutor.close();
  await learner.close();
});

test("discussion validates empty and long input, retries lost acknowledgement once, survives reload and second tab", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  const open = async (p: typeof page) => {
    await p.getByRole("button", { name: /^Задания(?: \d+)?$/ }).click();
    await p
      .getByText("Линейные уравнения: от шага к решению", { exact: true })
      .first()
      .click();
  };
  await open(page);
  const field = page.getByLabel("Сообщение по заданию"),
    send = page.getByRole("button", {
      name: "Отправить сообщение",
      exact: true,
    });
  await expect(send).toBeDisabled();
  await field.fill("   ");
  await expect(send).toBeDisabled();
  await field.fill("Я".repeat(3100));
  expect((await field.inputValue()).length).toBeLessThanOrEqual(3000);
  const text = "Вопрос 🧪 <script>это текст</script> & кавычки «да»";
  await field.fill(text);
  await page.route("**/api/assignments/*/messages", async (route) => {
    if (route.request().method() === "POST") {
      expect((await route.fetch()).ok()).toBeTruthy();
      await route.abort();
    } else await route.continue();
  });
  await send.click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(field).toHaveValue(text);
  await page.unroute("**/api/assignments/*/messages");
  await send.click();
  await expect(field).toHaveValue("");
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
  await page.reload();
  await open(page);
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "Я ученик", exact: true }).click();
  await open(other);
  await expect(other.getByText(text, { exact: true })).toHaveCount(1);
  await other.getByLabel("Сообщение по заданию").fill("Со второй вкладки");
  await other
    .getByRole("button", { name: "Отправить сообщение", exact: true })
    .click();
  await expect(
    page.getByText("Со второй вкладки", { exact: true }),
  ).toBeVisible();
  await other.close();
});
