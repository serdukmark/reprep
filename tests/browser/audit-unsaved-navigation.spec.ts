import { test, expect } from "./audit-fixtures";
for (const role of ["tutor", "learner"])
  test(`${role}: refusing navigation preserves unsaved input and accepting returns to requested page`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", {
        name: role === "tutor" ? "Я преподаватель" : "Я ученик",
        exact: true,
      })
      .click();
    let label = "";
    if (role === "tutor") {
      await page
        .getByRole("button", { name: "Создать задание", exact: true })
        .click();
      label = "Название работы";
    } else {
      await page
        .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
        .click();
      label = "Ответ на задание 1";
      await page.route("**/api/assignments/*/draft", (r) => r.abort());
    }
    await page
      .getByLabel(label, { exact: true })
      .fill("Несохранённый текст 🧪");
    let prompts = 0;
    page.once("dialog", async (d) => {
      prompts++;
      await d.dismiss();
    });
    await page.getByRole("button", { name: "К заданиям", exact: true }).click();
    expect(prompts).toBe(1);
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(
      "Несохранённый текст 🧪",
    );
    page.once("dialog", async (d) => {
      prompts++;
      await d.accept();
    });
    await page.getByRole("button", { name: "К заданиям", exact: true }).click();
    expect(prompts).toBe(2);
    await expect(
      page.getByRole("heading", { name: "Задания", exact: true }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Найти задание")).toBeVisible();
  });
