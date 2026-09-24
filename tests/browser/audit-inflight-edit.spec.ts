import { test, expect, choose } from "./audit-fixtures";
for (const kind of ["workspace", "lesson", "material"])
  test(`${kind}: edits made while save is in flight are blocked or preserved`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await page
      .getByRole("button", {
        name:
          kind === "workspace"
            ? "Ученики"
            : kind === "lesson"
              ? "Расписание"
              : "Материалы",
        exact: true,
      })
      .click();
    if (kind !== "workspace")
      await page
        .getByRole("button", {
          name: kind === "lesson" ? "Добавить занятие" : "Добавить материал",
          exact: true,
        })
        .click();
    const field = page.getByLabel(
      kind === "workspace" ? "Название пространства" : "Название",
      { exact: true },
    );
    const title = "Долгое сохранение " + kind;
    await field.fill(title);
    if (kind !== "workspace") {
      await choose(
        page.getByRole("combobox", { name: "Ученик", exact: true }),
        "demo-link",
      );
      if (kind === "lesson")
        await page
          .getByLabel("Начало (ваш часовой пояс)")
          .fill("2026-12-31T18:00");
      else
        await page
          .getByLabel("Ссылка HTTPS")
          .fill("https://example.invalid/audit");
    }
    let release!: () => void, start!: () => void;
    const held = new Promise<void>((r) => (release = r)),
      seen = new Promise<void>((r) => (start = r));
    const path =
      kind === "workspace"
        ? "/api/workspaces"
        : kind === "lesson"
          ? "/api/lessons"
          : "/api/materials";
    await page.route("**" + path, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      expect(response.ok()).toBeTruthy();
      start();
      await held;
      await route.fulfill({ response });
    });
    const ack = page.waitForResponse(
      (r) => r.url().endsWith(path) && r.request().method() === "POST",
    );
    await page
      .getByRole("button", {
        name: kind === "workspace" ? "Создать пространство" : "Сохранить",
        exact: true,
      })
      .click();
    await seen;
    let edited = false;
    try {
      if (await field.isEnabled()) {
        edited = true;
        await field.fill("Новая правка во время сохранения");
      }
    } finally {
      release();
    }
    await (await ack).finished();
    await page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        ),
    );
    if (edited)
      await expect(field).toHaveValue("Новая правка во время сохранения");
    else if (kind === "workspace")
      await expect(
        page.getByRole("combobox", {
          name: "Текущее пространство",
          exact: true,
        }),
      ).toHaveText(title);
    else
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
  });
