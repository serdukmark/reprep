import { test, expect, choose } from "./audit-fixtures";

test("skill graph refuses cycles and dangling edges, then saves corrected graph", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  await page
    .getByLabel("Навыки графа (каждый с новой строки)")
    .fill("Основа 🧪\nСледствие Ё");
  for (const [from, to] of [
    ["Основа 🧪", "Следствие Ё"],
    ["Следствие Ё", "Основа 🧪"],
  ]) {
    await choose(
      page.getByRole("combobox", { name: "Сначала навык", exact: true }),
      from,
    );
    await choose(
      page.getByRole("combobox", { name: "Затем навык", exact: true }),
      to,
    );
    await page
      .getByRole("button", { name: "Добавить связь", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Сохранить граф", exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByText("Граф сохранён", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Удалить связь", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Сохранить граф", exact: true })
    .click();
  await expect(page.getByText("Граф сохранён", { exact: true })).toBeVisible();
  await page
    .getByLabel("Навыки графа (каждый с новой строки)")
    .fill("Основа 🧪");
  await page
    .getByRole("button", { name: "Сохранить граф", exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Удалить связь", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Сохранить граф", exact: true })
    .click();
  await expect(page.getByText("Граф сохранён", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  await expect(
    page.getByLabel("Навыки графа (каждый с новой строки)"),
  ).toHaveValue("Основа 🧪");
});

test("material rejects bad extension, empty, oversize, NUL and invalid UTF8 before upload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Материалы", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить материал", exact: true })
    .click();
  await page.getByLabel("Название", { exact: true }).fill("Проверка файла 🧪");
  await choose(
    page.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  let posts = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/materials") && r.method() === "POST") posts++;
  });
  for (const [name, buffer] of [
    ["bad.exe", Buffer.from("text")],
    ["empty.txt", Buffer.from("   ")],
    ["big.txt", Buffer.alloc(60001, 65)],
    ["nul.txt", Buffer.from([65, 0, 66])],
    ["encoding.txt", Buffer.from([255, 254, 255])],
  ] as [string, Buffer][]) {
    await test.step(name, async () => {
      await page
        .getByLabel(/Или файл TXT/)
        .setInputFiles({ name, mimeType: "text/plain", buffer });
      await expect(page.getByRole("alert").first()).toBeVisible();
      expect(posts).toBe(0);
    });
  }
  await page
    .getByLabel(/Или файл TXT/)
    .setInputFiles({
      name: "good.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Безопасный текст Ё 🧪 <script>"),
    });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Скачать good.txt", exact: true }),
  ).toBeVisible();
  expect(posts).toBe(1);
});
