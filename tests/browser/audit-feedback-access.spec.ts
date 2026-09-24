import { test, expect } from "./audit-fixtures";
import type { Page } from "@playwright/test";
async function openSubmitted(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  await page
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await page.getByLabel("Ответ на задание 1").fill("5");
  await page.getByRole("radio", { name: "0,75", exact: true }).check();
  await page
    .getByLabel("Ответ на задание 3")
    .fill("Одинаковое действие с обеими частями");
  await expect(page.getByRole("status")).toHaveText("Сохранено");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Обратная связь о разборе" }),
  ).toBeVisible();
}
for (const mode of ["foreign", "session"] as const) {
  test(`feedback ${mode}: server refusal remains visible and does not erase unsent comment`, async ({
    page,
  }) => {
    await openSubmitted(page);
    const text = "Ошибка в объяснении 🧪 <>&";
    await page.getByLabel("Комментарий к разбору").fill(text);
    let denied = 0;
    if (mode === "foreign") {
      await page.route("**/api/reports", async (r) => {
        const response = await r.fetch({
          postData: {
            ...r.request().postDataJSON(),
            context_id: "demo-assignment-2",
          },
        });
        expect(response.status()).toBe(404);
        denied++;
        await r.fulfill({ response });
      });
    } else {
      expect(
        await page.evaluate(
          async () =>
            (
              await fetch("/api/logout", {
                method: "POST",
                headers: {
                  Authorization:
                    "Bearer " + sessionStorage.getItem("reprep.session"),
                },
              })
            ).status,
        ),
      ).toBe(200);
      page.on("response", (r) => {
        if (new URL(r.url()).pathname === "/api/reports" && r.status() === 401)
          denied++;
      });
    }
    await page
      .getByRole("button", { name: "Отправить отзыв о разборе", exact: true })
      .click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect.poll(() => denied).toBe(1);
    await expect(page.getByLabel("Комментарий к разбору")).toHaveValue(text);
    await expect(
      page.getByText("Сообщение сохранено для разбора командой", {
        exact: true,
      }),
    ).toHaveCount(0);
    await page.unroute("**/api/reports");
    await page.reload();
    if (mode === "session")
      await page.getByRole("button", { name: "Я ученик", exact: true }).click();
    await page
      .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
      .click();
    await page.getByLabel("Комментарий к разбору").fill(text);
    const response = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/reports" && r.status() === 200,
    );
    await page
      .getByRole("button", { name: "Отправить отзыв о разборе", exact: true })
      .click();
    await response;
    await expect(
      page.getByText("Сообщение сохранено для разбора командой", {
        exact: true,
      }),
    ).toBeVisible();
  });
}
test("feedback pending response locks submitted fields and double click sends one report", async ({
  page,
}) => {
  await openSubmitted(page);
  const text = "Мой отзыв 🧪";
  await page.getByLabel("Комментарий к разбору").fill(text);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let calls = 0;
  await page.route("**/api/reports", async (r) => {
    calls++;
    expect(r.request().postDataJSON().text).toBe(text);
    const response = await r.fetch();
    await gate;
    await r.fulfill({ response });
  });
  try {
    await page
      .getByRole("button", { name: "Отправить отзыв о разборе", exact: true })
      .dblclick();
    await expect.poll(() => calls).toBe(1);
    await expect(page.getByLabel("Комментарий к разбору")).toBeDisabled();
    await expect(
      page.getByRole("combobox", { name: "Тип отзыва", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByText("Сообщение сохранено для разбора командой", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Комментарий к разбору")).toBeEnabled();
  await expect(page.getByLabel("Комментарий к разбору")).toHaveValue("");
});
