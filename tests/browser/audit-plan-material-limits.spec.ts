import { test, expect, choose } from "./audit-fixtures";
test("plan validates required fields and limits, warns before leaving, preserves input across failed save", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  const goal = page.getByRole("textbox", {
      name: "Цель программы",
      exact: true,
    }),
    save = page.getByRole("button", {
      name: "Сохранить программу",
      exact: true,
    });
  let writes = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/plan") && r.method() === "PUT") writes++;
  });
  await save.click();
  expect(writes).toBe(0);
  await goal.fill("Я".repeat(1100));
  expect((await goal.inputValue()).length).toBe(1000);
  await goal.fill("Программа 🧪 <без HTML>");
  await page.getByLabel("Учебный уровень").fill("Я".repeat(120));
  expect((await page.getByLabel("Учебный уровень").inputValue()).length).toBe(
    100,
  );
  const add = page.getByRole("button", { name: "Добавить этап", exact: true });
  await add.click();
  await save.click();
  expect(writes).toBe(0);
  await page.getByLabel("Этап 1", { exact: true }).fill("Я".repeat(180));
  expect(
    (await page.getByLabel("Этап 1", { exact: true }).inputValue()).length,
  ).toBe(160);
  await page.getByLabel("Этап 1", { exact: true }).fill("Этап 🧪");
  await page.getByLabel("Навык этапа 1", { exact: true }).fill("Алгебра");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Расписание", exact: true }).click();
  await expect(goal).toHaveValue("Программа 🧪 <без HTML>");
  await page.route("**/api/relationships/*/plan", (r) =>
    r.request().method() === "PUT" ? r.abort() : r.continue(),
  );
  await save.click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(goal).toHaveValue("Программа 🧪 <без HTML>");
  await page.unroute("**/api/relationships/*/plan");
  await save.dblclick();
  await expect(
    page.getByText("Программа сохранена", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  await expect(goal).toHaveValue("Программа 🧪 <без HTML>");
  for (let i = 1; i < 50; i++) await add.click();
  await expect(add).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /^Удалить этап \d+$/ }),
  ).toHaveCount(50);
});
test("material rejects non-HTTPS and oversized links without claiming success, then saves corrected Unicode note", async ({
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
  await page.getByLabel("Название", { exact: true }).fill("Материал 🧪");
  await choose(
    page.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  const url = page.getByLabel("Ссылка HTTPS"),
    save = page.getByRole("button", { name: "Сохранить", exact: true });
  let writes = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/materials") && r.method() === "POST") writes++;
  });
  for (const value of [
    "",
    "javascript:alert(1)",
    "http://example.invalid/material",
  ]) {
    await url.fill(value);
    await save.click();
    expect(writes).toBe(0);
  }
  const long = "https://example.invalid/" + "a".repeat(2100);
  await url.fill(long);
  await save.click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(url).toHaveValue(long);
  await url.fill("https://example.invalid/material");
  await page
    .getByRole("textbox", { name: "Пояснение", exact: true })
    .fill("Объяснение 🧪 <script>только текст</script>");
  await save.click();
  await expect(
    page.getByRole("heading", { name: "Материал 🧪", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Объяснение 🧪 <script>только текст</script>", {
      exact: true,
    }),
  ).toBeVisible();
});
