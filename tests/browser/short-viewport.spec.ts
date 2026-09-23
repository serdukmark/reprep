import { test, expect } from "./audit-fixtures";
test("account controls remain reachable in short desktop and mobile navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: /Алекс • демо/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Напоминания в мессенджере",
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 600 });
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await page.getByRole("button", { name: /Алекс • демо/ }).click();
  await expect(
    page.getByRole("heading", { name: "Настройки и помощь", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
