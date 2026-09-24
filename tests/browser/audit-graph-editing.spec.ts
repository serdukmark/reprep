import { test, expect } from "./audit-fixtures";
test("graph accepts empty configuration, rejects duplicates and size limits, preserves concurrent edits and offline input", async ({
  browser,
}) => {
  const a = await browser.newPage(),
    b = await browser.newPage();
  const open = async (p: typeof a) => {
    await p.getByRole("button", { name: "Ученики", exact: true }).click();
    await p.getByRole("button", { name: /Саша • демо/ }).click();
  };
  const login = async (p: typeof a) => {
    await p.goto("/");
    await p
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await open(p);
  };
  await login(a);
  const field = a.getByRole("textbox", {
      name: "Навыки графа (каждый с новой строки)",
      exact: true,
    }),
    save = a.getByRole("button", { name: "Сохранить граф", exact: true });
  await field.fill("");
  await save.click();
  await expect(a.getByText("Граф сохранён", { exact: true })).toBeVisible();
  for (const value of [
    "Навык\nнавык",
    "Я".repeat(101),
    Array.from({ length: 51 }, (_, i) => "Навык " + i).join("\n"),
  ]) {
    await field.fill(value);
    await save.click();
    await expect(a.getByRole("alert").first()).toBeVisible();
    await expect(field).toHaveValue(value);
  }
  await field.fill("Навык 🧪 <без HTML>");
  await a.route("**/api/relationships/*/skill-graph", (route) =>
    route.request().method() === "PUT" ? route.abort() : route.continue(),
  );
  await save.click();
  await expect(a.getByRole("alert").first()).toBeVisible();
  await expect(field).toHaveValue("Навык 🧪 <без HTML>");
  await a.unroute("**/api/relationships/*/skill-graph");
  await save.dblclick();
  await expect(a.getByText("Граф сохранён", { exact: true })).toBeVisible();
  await login(b);
  await expect(
    b.getByLabel("Навыки графа (каждый с новой строки)"),
  ).toHaveValue("Навык 🧪 <без HTML>");
  await field.fill("Новая версия графа");
  await save.click();
  await expect(a.getByText("Граф сохранён", { exact: true })).toBeVisible();
  await b
    .getByLabel("Навыки графа (каждый с новой строки)")
    .fill("Старое окно");
  await b.getByRole("button", { name: "Сохранить граф", exact: true }).click();
  await expect(b.getByRole("alert").first()).toBeVisible();
  await expect(
    b.getByLabel("Навыки графа (каждый с новой строки)"),
  ).toHaveValue("Старое окно");
  await a.reload();
  await open(a);
  await expect(field).toHaveValue("Новая версия графа");
  await a.close();
  await b.close();
});
