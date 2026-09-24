import { test, expect } from "./audit-fixtures";
test("catalog profile rejects invalid fields and stale second-tab save without losing typed input", async ({
  browser,
}) => {
  const a = await browser.newPage(),
    b = await browser.newPage();
  const login = async (p: typeof a) => {
    await p.goto("/");
    await p
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await p.getByRole("button", { name: "Репетиторы", exact: true }).click();
  };
  await login(a);
  const save = a.getByRole("button", { name: "Сохранить анкету", exact: true });
  let writes = 0;
  a.on("request", (r) => {
    if (r.url().endsWith("/api/catalog/profile") && r.method() === "PUT")
      writes++;
  });
  await save.click();
  expect(writes).toBe(0);
  await a.getByLabel("Заголовок анкеты").fill("Я".repeat(200));
  expect((await a.getByLabel("Заголовок анкеты").inputValue()).length).toBe(
    120,
  );
  await a
    .getByRole("textbox", { name: "О занятиях", exact: true })
    .fill("Я".repeat(1500));
  expect(
    (
      await a
        .getByRole("textbox", { name: "О занятиях", exact: true })
        .inputValue()
    ).length,
  ).toBe(1200);
  await a.getByLabel("Заголовок анкеты").fill("Математика 🧪 <без HTML>");
  await a
    .getByRole("textbox", { name: "О занятиях", exact: true })
    .fill("Синтетическое описание занятий и программы.");
  const subjects = a.getByRole("textbox", {
    name: "Предметы анкеты (каждый с новой строки)",
    exact: true,
  });
  await subjects.fill("Математика");
  for (const [label, value] of [
    ["Стоимость занятия, руб.", "-1"],
    ["Стоимость занятия, руб.", "100001"],
    ["Длительность занятия, минут", "14"],
    ["Длительность занятия, минут", "241"],
  ]) {
    await a.getByLabel(label, { exact: true }).fill(value);
    await save.click();
    expect(writes).toBe(0);
    await a
      .getByLabel(label, { exact: true })
      .fill(label.startsWith("Стоимость") ? "500" : "60");
  }
  for (const value of [
    "Математика\nматематика",
    "Я".repeat(101),
    Array.from({ length: 11 }, (_, i) => "Предмет " + i).join("\n"),
  ]) {
    await subjects.fill(value);
    await save.click();
    await expect(a.getByRole("alert")).toBeVisible();
    await expect(subjects).toHaveValue(value);
  }
  await subjects.fill("Математика");
  await save.dblclick();
  await expect(a.getByRole("status")).toHaveText("Анкета сохранена");
  await login(b);
  await expect(b.getByLabel("Заголовок анкеты")).toHaveValue(
    "Математика 🧪 <без HTML>",
  );
  await a.getByLabel("Заголовок анкеты").fill("Новая версия анкеты");
  await save.click();
  await expect(a.getByRole("status")).toHaveText("Анкета сохранена");
  await b.getByLabel("Стоимость занятия, руб.").fill("777");
  await b
    .getByRole("button", { name: "Сохранить анкету", exact: true })
    .click();
  await expect(b.getByRole("alert")).toBeVisible();
  await expect(b.getByLabel("Стоимость занятия, руб.")).toHaveValue("777");
  await a.reload();
  await a.getByRole("button", { name: "Репетиторы", exact: true }).click();
  await expect(a.getByLabel("Заголовок анкеты")).toHaveValue(
    "Новая версия анкеты",
  );
  await expect(a.getByLabel("Стоимость занятия, руб.")).toHaveValue("500");
  await a.close();
  await b.close();
});
