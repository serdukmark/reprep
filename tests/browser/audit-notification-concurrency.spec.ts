import { test, expect } from "./audit-fixtures";
test("two learner tabs preserve independent reminder preference changes", async ({
  browser,
  request,
}) => {
  expect(
    (await request.post("/__audit__/notification-contacts")).ok(),
  ).toBeTruthy();
  const a = await browser.newPage(),
    b = await browser.newPage();
  const open = async (p: typeof a) =>
    p.getByRole("button", { name: /Саша • демо/ }).click();
  for (const p of [a, b]) {
    await p.goto("/");
    await p.getByRole("button", { name: "Я ученик", exact: true }).click();
    await open(p);
    await expect(p.getByLabel("О ближайших занятиях")).toBeEnabled();
  }
  await a.getByLabel("О ближайших занятиях").check();
  await a
    .getByRole("button", { name: "Сохранить напоминания", exact: true })
    .click();
  await expect(a.getByRole("status")).toHaveText(
    "Настройки напоминаний сохранены",
  );
  await b.getByLabel("О сроках заданий").check();
  await b
    .getByRole("button", { name: "Сохранить напоминания", exact: true })
    .click();
  await expect(b.getByRole("status")).toHaveText(
    "Настройки напоминаний сохранены",
  );
  await a.reload();
  await open(a);
  await expect(a.getByLabel("О ближайших занятиях")).toBeChecked();
  await expect(a.getByLabel("О сроках заданий")).toBeChecked();
  await a.close();
  await b.close();
});
