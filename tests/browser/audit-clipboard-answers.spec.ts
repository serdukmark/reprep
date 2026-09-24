import { test, expect } from "./audit-fixtures";
test("copy invitation reports denied clipboard and copies exact code after permission succeeds", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).denyClipboard = true;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          if ((window as any).denyClipboard)
            throw new DOMException(
              "Нет разрешения на буфер",
              "NotAllowedError",
            );
          (window as any).copiedAuditText = text;
        },
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await page.getByRole("button", { name: "Ученики", exact: true }).click();
  await page
    .getByRole("button", { name: "Пригласить ученика", exact: true })
    .click();
  const code = await page.locator(".invite-box code").innerText();
  await page
    .getByRole("button", { name: "Скопировать код", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Код скопирован", { exact: true })).toHaveCount(
    0,
  );
  await page.evaluate(() => ((window as any).denyClipboard = false));
  await page
    .getByRole("button", { name: "Скопировать код", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).copiedAuditText)).toBe(code);
  await expect(page.getByText("Код скопирован", { exact: true })).toBeVisible();
});
test("learner cannot submit missing task answers and preserves all three answer types with long Unicode text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Я ученик", exact: true }).click();
  await page
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  page.on("dialog", (d) => d.accept());
  for (let i = 0; i < 3; i++) {
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/submit") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Отправить работу", exact: true })
      .click();
    expect((await response).status()).toBe(422);
    await expect(page.getByRole("alert").first()).toBeVisible();
    if (i === 0) await page.getByLabel("Ответ на задание 1").fill("5");
    if (i === 1)
      await page.getByRole("radio", { name: "0,75", exact: true }).check();
  }
  await page
    .getByRole("textbox", { name: "Ответ на задание 3", exact: true })
    .fill("Я".repeat(5100));
  expect(
    (
      await page
        .getByRole("textbox", { name: "Ответ на задание 3", exact: true })
        .inputValue()
    ).length,
  ).toBeLessThanOrEqual(5000);
  const answer = "Пояснение 🧪 <script>это текст</script> & равенство";
  await page
    .getByRole("textbox", { name: "Ответ на задание 3", exact: true })
    .fill(answer);
  await page
    .getByRole("button", { name: "Сохранить ответы", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Сохранено");
  await page.reload();
  await page
    .getByRole("button", { name: /Линейные уравнения: от шага к решению/ })
    .click();
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("5");
  await expect(
    page.getByRole("radio", { name: "0,75", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "Ответ на задание 3", exact: true }),
  ).toHaveValue(answer);
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  await expect(page.locator(".work-task .original p").last()).toHaveText(
    answer,
  );
});
