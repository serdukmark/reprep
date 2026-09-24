import { test, expect } from "./audit-fixtures";
test("hung draft save times out visibly, unlocks controls and preserves answer for retry", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  const open = async () =>
    page
      .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
      .click();
  await open();
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/assignments/*/draft", async (route) => {
    await held;
    await route.abort().catch(() => {});
  });
  await page.getByLabel("Ответ на задание 1").fill("73");
  await page
    .getByRole("button", { name: "Сохранить ответы", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Сохраняем…");
  await expect(page.getByLabel("Ответ на задание 1")).toBeDisabled();
  try {
    await expect(page.locator(".save-error")).toContainText(
      "Сервер не ответил вовремя",
      { timeout: 20000 },
    );
    await expect(page.getByLabel("Ответ на задание 1")).toBeEnabled();
    await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("73");
    await expect(page.getByRole("status")).not.toHaveText("Сохранено");
  } finally {
    release();
    await page.unroute("**/api/assignments/*/draft");
  }
  await page
    .getByRole("button", { name: "Сохранить ответы", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Сохранено");
  await page.reload();
  await open();
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("73");
});
