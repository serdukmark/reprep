import { test, expect, choose } from "./audit-fixtures";

test("invalid generation leaves material intact and retry available after reload", async ({
  browser,
}) => {
  test.skip(
    process.env.E2E_LIVE_GENERATION !== "1" &&
      process.env.E2E_FIXTURE_GENERATION !== "1",
    "Requires explicitly enabled fixture generation or synthetic paid AI run",
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
  await choose(
    tutor.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  await tutor.getByLabel("Или файл TXT").setInputFiles({
    name: "source.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "AUD_AI_EMPTY Чтобы решить 3x + 7 = 22, вычтите 7 из обеих частей: 3x = 15. Затем разделите обе части на 3: x = 5. Проверка: 3 умножить на 5 плюс 7 равно 22.",
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
    tutor.getByText(/AI не смог подготовить корректный черновик/),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    tutor.getByRole("button", { name: /Открыть AI-черновик/ }),
  ).toHaveCount(0);
  await expect(
    tutor.getByRole("button", { name: "Скачать source.txt", exact: true }),
  ).toBeVisible();
  await tutor.reload();
  await tutor.getByRole("button", { name: "Материалы", exact: true }).click();
  await tutor
    .getByText("Создать задания из этого TXT", { exact: true })
    .click();
  await expect(
    tutor.getByText(/AI не смог подготовить корректный черновик/),
  ).toBeVisible();
  await expect(
    tutor.getByRole("button", { name: "Подготовить AI-черновик", exact: true }),
  ).toBeEnabled();
  await tutor.close();
  await learner.close();
});
