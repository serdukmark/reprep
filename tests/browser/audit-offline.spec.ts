import { test, expect } from "./audit-fixtures";
test("whole browser goes offline mid-answer, never claims submission and restores saved work after reconnect", async ({
  page,
  context,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  const open = async () =>
    page
      .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
      .click();
  await open();
  await page.getByLabel("Ответ на задание 1").fill("5");
  await page.getByRole("radio", { name: "0,75", exact: true }).check();
  await page.getByLabel("Ответ на задание 3").fill("Равенство сохраняется 🧪");
  await expect(page.getByRole("status")).toHaveText("Сохранено");
  await context.setOffline(true);
  try {
    await page.getByLabel("Ответ на задание 1").fill("7");
    await expect(page.locator(".save-error")).toBeVisible();
    await page
      .getByRole("button", { name: "Отправить работу", exact: true })
      .click();
    await expect(page.locator(".save-error")).toBeVisible();
    await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("7");
    await expect(
      page.getByRole("button", { name: "Отправить работу", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText("Ответы сохранены и отправлены.", { exact: false }),
    ).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
  await page
    .getByRole("button", { name: "Сохранить ответы", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Сохранено");
  await page.reload();
  await open();
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("7");
  await expect(
    page.getByRole("radio", { name: "0,75", exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Ответ на задание 3")).toHaveValue(
    "Равенство сохраняется 🧪",
  );
});
