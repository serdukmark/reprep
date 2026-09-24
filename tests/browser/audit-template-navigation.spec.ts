import { test, expect, choose } from "./audit-fixtures";
test("late template copy does not reopen editor after leaving library", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByLabel("Название пространства").fill("Библиотека навигации");
  await page
    .getByRole("button", { name: "Создать пространство", exact: true })
    .click();
  await choose(
    page.getByRole("combobox", { name: "Моя работа для шаблона", exact: true }),
    "demo-assignment",
  );
  await page
    .getByRole("button", { name: "Поделиться с участниками", exact: true })
    .click();
  await choose(
    page.getByRole("combobox", { name: "Мой ученик для копии", exact: true }),
    "demo-link",
  );
  let release!: () => void, start!: () => void;
  const held = new Promise<void>((r) => (release = r)),
    seen = new Promise<void>((r) => (start = r));
  let url = "";
  await page.route("**/api/workspace-templates/*/copy", async (route) => {
    url = route.request().url();
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    start();
    await held;
    await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Создать мой черновик", exact: true })
    .click();
  await seen;
  await page.getByRole("button", { name: "Расписание", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Расписание", exact: true }),
  ).toBeVisible();
  const ack = page.waitForResponse((r) => r.url() === url);
  release();
  await (await ack).finished();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "Расписание", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Название работы")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /^Задания(?: \d+)?$/ }).click();
  await expect(
    page.getByRole("button", { name: /Линейные уравнения: от шага к решению/ }),
  ).toHaveCount(2);
});
