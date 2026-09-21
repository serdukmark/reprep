import { test, expect } from "@playwright/test";

test("live material generation stays a draft until tutor publishes and includes its source", async ({
  browser,
}) => {
  test.skip(
    process.env.E2E_LIVE_GENERATION !== "1",
    "Requires explicitly enabled synthetic paid AI run",
  );
  const tutor = await browser.newPage(),
    learner = await browser.newPage();
  await tutor.goto("/");
  await tutor.getByRole("button", { name: "Я преподаватель" }).click();
  await tutor.getByRole("button", { name: "Материалы", exact: true }).click();
  await tutor
    .getByRole("button", { name: "Добавить материал", exact: true })
    .click();
  await tutor
    .getByLabel("Название", { exact: true })
    .fill("Пример для генерации");
  await tutor
    .getByRole("combobox", { name: "Ученик", exact: true })
    .selectOption("demo-link");
  await tutor
    .getByLabel("Или файл TXT")
    .setInputFiles({
      name: "source.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Чтобы решить 3x + 7 = 22, вычтите 7 из обеих частей: 3x = 15. Затем разделите обе части на 3: x = 5. Проверка: 3 умножить на 5 плюс 7 равно 22.",
      ),
    });
  await tutor.getByRole("checkbox", { name: /Разрешаю/ }).check();
  await tutor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await tutor
    .getByText("Создать задания из этого TXT", { exact: true })
    .click();
  await tutor.getByLabel("Количество заданий").fill("1");
  await tutor
    .getByRole("button", { name: "Подготовить AI-черновик", exact: true })
    .click();
  await expect(
    tutor.getByRole("button", {
      name: "Открыть AI-черновик (1 заданий)",
      exact: true,
    }),
  ).toBeVisible({ timeout: 65000 });
  await tutor
    .getByRole("button", {
      name: "Открыть AI-черновик (1 заданий)",
      exact: true,
    })
    .click();
  await expect(tutor.getByRole("textbox", { name:"Условие", exact: true })).not.toHaveValue(
    "",
  );
  const title = await tutor.getByLabel("Название работы").inputValue();
  await learner.goto("/");
  await learner.getByRole("button", { name: "Я ученик" }).click();
  await learner.getByRole("button", { name: "Задания", exact: true }).click();
  await expect(
    learner.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(0);
  await tutor.screenshot({
    path: "artifacts/ui-generated-draft.png",
    fullPage: true,
  });
  await tutor
    .getByRole("button", { name: "Назначить ученику", exact: true })
    .click();
  await expect(
    tutor.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await learner.reload();
  await learner.getByRole("button", { name: "Задания", exact: true }).click();
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    learner.getByRole("heading", { name: "Материалы к работе", exact: true }),
  ).toBeVisible();
  await expect(
    learner.getByRole("button", { name: "Скачать source.txt", exact: true }),
  ).toBeVisible();
  await expect(
    learner.getByText("Эталон и критерии", { exact: true }),
  ).toHaveCount(0);
  await tutor.close();
  await learner.close();
});
