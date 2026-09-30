import { test, expect } from "./audit-fixtures";

// A reviewer looks at one role, signs out from the first screen and opens
// another role in the same browser: no settings detour, no cleared storage.
for (const width of [1280, 390])
  test(`demo learner signs out from the first screen and returns as tutor (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/");
    await page.getByRole("button", { name: "Я ученик", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    for (const role of ["Я преподаватель", "Я ученик", "Я родитель"])
      await expect(page.getByRole("button", { name: role, exact: true })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("reprep.session"))).toBeNull();

    await page.getByRole("button", { name: "Я преподаватель", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Хороший день, чтобы учить.", exact: true })).toBeVisible();
    const me = await page.evaluate(async () => {
      const r = await fetch("/api/me", { headers: { Authorization: "Bearer " + sessionStorage.getItem("reprep.session") } });
      return r.json();
    });
    expect(me.role).toBe("tutor");

    // The tutor can leave the same way and come back as a learner.
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await page.getByRole("button", { name: "Я ученик", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ваш следующий шаг.", exact: true })).toBeVisible();
  });
