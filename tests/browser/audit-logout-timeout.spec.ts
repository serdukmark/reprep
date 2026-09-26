import { test, expect } from "./audit-fixtures";
for (const role of ["tutor", "guardian"])
  test(`logout ${role}: real request timeout clears this tab without claiming server revocation`, async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", {
        name: role === "tutor" ? "Я преподаватель" : "Я родитель",
        exact: true,
      })
      .click();
    if (role === "tutor")
      await page.getByRole("button", { name: /Алекс • демо/ }).click();
    else
      await expect(
        page.getByRole("heading", { name: "Кабинет родителя", exact: true }),
      ).toBeVisible();
    const token = await page.evaluate(() =>
      sessionStorage.getItem("reprep.session"),
    );
    let calls = 0;
    // Leave the actual browser request unresolved: production AbortController,
    // not a mocked clock or fabricated timeout response, must stop waiting.
    await page.route("**/api/logout", () => {
      calls++;
    });
    const started = Date.now();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Я ученик", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(14000);
    expect(calls).toBe(1);
    expect(
      await page.evaluate(() => sessionStorage.getItem("reprep.session")),
    ).toBeFalsy();
    await expect(page.getByRole("alert").first()).toContainText(
      "Не удалось подтвердить отзыв сессии на сервере",
    );
    await expect(
      page.getByRole("heading", { name: "Кабинет родителя", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Алекс • демо/ }),
    ).toHaveCount(0);
    expect(
      (
        await request.get("/api/me", {
          headers: { Authorization: "Bearer " + token },
        })
      ).status(),
    ).toBe(200);
    await page.unroute("**/api/logout");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Я ученик", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Я ученик", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true }),
    ).toBeVisible();
  });
