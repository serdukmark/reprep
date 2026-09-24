import { test, expect } from "./audit-fixtures";
for (const role of ["tutor", "guardian"])
  test(`logout ${role} double click shares one operation and cannot erase a later login`, async ({
    page,
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
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    await page.route("**/api/logout", async (r) => {
      calls++;
      const response = await r.fetch();
      if (calls === 1) await gate;
      await r.fulfill({ response });
    });
    try {
      await page.getByRole("button", { name: "Выйти", exact: true }).dblclick();
      // A subsequent same-origin request completes after both click handlers ran.
      await page.evaluate(async () => {
        await fetch("/api/health");
      });
      expect(calls).toBe(1);
    } finally {
      release();
    }
    await expect(
      page.getByRole("button", { name: "Я ученик", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Я ученик", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true }),
    ).toBeVisible();
  });
