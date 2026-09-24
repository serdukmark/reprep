import { test, expect } from "./audit-fixtures";
test("switching learner clears editable plan and graph while the next learner loads or fails", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  await page.getByLabel("Цель программы").fill("План только для Саши");
  await page
    .getByRole("button", { name: "Сохранить программу", exact: true })
    .click();
  await expect(
    page.getByText("Программа сохранена", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Навыки графа (каждый с новой строки)")
    .fill("Навык только для Саши");
  await page
    .getByRole("button", { name: "Сохранить граф", exact: true })
    .click();
  await expect(page.getByText("Граф сохранён", { exact: true })).toBeVisible();
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const pattern = "**/api/relationships/demo-link-2/*";
  let intercepted = 0;
  await page.route(pattern, async (route) => {
    if (!/(plan|skill-graph)$/.test(route.request().url()))
      return route.continue();
    intercepted++;
    await held;
    await route.abort("connectionreset");
  });
  try {
    await page.getByRole("button", { name: /Женя • демо/ }).click();
    await expect.poll(() => intercepted).toBe(2);
    await expect(page.getByLabel("Цель программы")).toHaveCount(0);
    await expect(
      page.getByLabel("Навыки графа (каждый с новой строки)"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Сохранить программу", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Сохранить граф", exact: true }),
    ).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByRole("alert")).toHaveCount(2);
  await page.unroute(pattern);
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  await expect(page.getByLabel("Цель программы")).toHaveValue(
    "План только для Саши",
  );
  await expect(
    page.getByLabel("Навыки графа (каждый с новой строки)"),
  ).toHaveValue("Навык только для Саши");
  await page.getByRole("button", { name: /Женя • демо/ }).click();
  await expect(page.getByLabel("Цель программы")).toHaveValue("");
  await expect(
    page.getByLabel("Навыки графа (каждый с новой строки)"),
  ).not.toHaveValue("Навык только для Саши");
});
