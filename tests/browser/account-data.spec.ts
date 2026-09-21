import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("learner can download own data and cancel deletion before operator processing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  await page.getByRole("button", { name: /Саша • демо/ }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Скачать мои данные", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("reprep-my-data.json");
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported.account.id).toBe("demo-learner");
  expect(
    exported.assignments.every((a: any) =>
      a.tasks.every((t: any) => t.answer === undefined),
    ),
  ).toBeTruthy();
  await page.getByLabel("Имя для запроса удаления").fill("Саша • демо");
  await page
    .getByRole("button", { name: "Запросить удаление аккаунта", exact: true })
    .click();
  await expect(
    page.getByText("Запрос на удаление ожидает обработки владельцем."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Отменить запрос на удаление", exact: true })
    .click();
  await expect(page.getByText("Запрос отменён", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Запросить удаление аккаунта",
      exact: true,
    }),
  ).toBeVisible();
});
