import { test, expect } from "./audit-fixtures";
const roles = [
  ["tutor", "Я преподаватель", "Алекс • демо", "Хороший день, чтобы учить."],
  ["learner", "Я ученик", "Саша • демо", "Ваш следующий шаг."],
  ["guardian", "Я родитель", "Родитель • демо", "Кабинет родителя"],
  [
    "outsider",
    "Другой преподаватель · демо",
    "Другой репетитор • демо",
    "Хороший день, чтобы учить.",
  ],
] as const;
for (const [role, button, alias, heading] of roles)
  test(`demo ${role}: offline login, double retry, reload and independent second tab`, async ({
    page,
    context,
    request,
  }) => {
    await page.goto("/");
    const path = "**/api/auth/demo/" + role;
    await page.route(path, (r) => r.abort("connectionreset"));
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: button, exact: true }),
    ).toBeEnabled();
    await page.unroute(path);
    let count = 0,
      release!: () => void,
      start!: () => void;
    const held = new Promise<void>((r) => (release = r)),
      seen = new Promise<void>((r) => (start = r));
    await page.route(path, async (route) => {
      count++;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      start();
      await held;
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: button, exact: true }).dblclick();
    await seen;
    expect(count).toBe(1);
    await expect(
      page.getByRole("button", { name: button, exact: true }),
    ).toBeDisabled();
    release();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await page.unroute(path);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    const second = await context.newPage();
    await second.goto("/");
    await second.getByRole("button", { name: button, exact: true }).click();
    await expect(
      second.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    const oldToken = await page.evaluate(() =>
      sessionStorage.getItem("reprep.session"),
    );
    if (role !== "guardian")
      await page.getByRole("button", { name: new RegExp(alias) }).click();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(
      page.getByRole("button", { name: button, exact: true }),
    ).toBeVisible();
    expect(
      (
        await request.get("/api/me", {
          headers: { Authorization: "Bearer " + oldToken },
        })
      ).status(),
    ).toBe(401);
    const next = role === "learner" ? roles[3] : roles[1];
    await page.getByRole("button", { name: next[1], exact: true }).click();
    await expect(
      page.getByRole("heading", { name: next[3], exact: true }),
    ).toBeVisible();
    await second.reload();
    await expect(
      second.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    if (role === "guardian")
      await expect(
        second.getByText(alias + " · ДЕМО · СИНТЕТИЧЕСКИЕ ДАННЫЕ", {
          exact: true,
        }),
      ).toBeVisible();
    else
      await expect(
        second.getByRole("button", { name: new RegExp(alias) }),
      ).toBeVisible();
    await second.close();
  });
