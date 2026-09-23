import { test, expect } from "./audit-fixtures";
import { readFile } from "node:fs/promises";
test("tutor exports selected progress JSON and sees truthful empty analytics", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  const waiting = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Экспорт прогресса", exact: true })
    .click();
  const download = await waiting;
  expect(download.suggestedFilename()).toBe("reprep-progress.json");
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(data.progress).toEqual([]);
  expect(data.subject).toBe("Математика · ЕГЭ");
  expect(JSON.stringify(data)).not.toContain("token");
  await page.getByRole("button", { name: /Алекс • демо/ }).click();
  await expect(
    page.getByRole("heading", { name: "Работа пространства", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".analytics")).toContainText("Заданий: 2");
  await expect(page.locator(".analytics")).toContainText("Сдач: 0");
  await expect(page.locator(".analytics")).toContainText("ещё нет данных");
});
