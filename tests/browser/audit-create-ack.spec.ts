import { test, expect, choose } from "./audit-fixtures";
for (const kind of ["workspace", "group", "lesson", "material"])
  test(`${kind}: retry after committed response loss creates only one resource`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    let field = "",
      button = "",
      path = "";
    const title = "Потерянное подтверждение " + kind;
    if (["workspace", "group"].includes(kind)) {
      await page.getByRole("button", { name: "Ученики", exact: true }).click();
      field =
        kind === "workspace" ? "Название пространства" : "Название группы";
      button =
        kind === "workspace" ? "Создать пространство" : "Сохранить группу";
      path = kind === "workspace" ? "/api/workspaces" : "/api/groups";
    } else {
      await page
        .getByRole("button", {
          name: kind === "lesson" ? "Расписание" : "Материалы",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: kind === "lesson" ? "Добавить занятие" : "Добавить материал",
          exact: true,
        })
        .click();
      field = "Название";
      button = "Сохранить";
      path = kind === "lesson" ? "/api/lessons" : "/api/materials";
    }
    await page.getByLabel(field, { exact: true }).fill(title);
    if (kind === "group")
      await page.getByRole("checkbox", { name: /Саша • демо/ }).check();
    if (["lesson", "material"].includes(kind)) {
      await choose(
        page.getByRole("combobox", { name: "Ученик", exact: true }),
        "demo-link",
      );
      if (kind === "lesson")
        await page
          .getByLabel("Начало (ваш часовой пояс)")
          .fill("2026-12-31T18:00");
      else
        await page.getByLabel("Ссылка HTTPS").fill("https://example.org/audit");
    }
    await page.route("**" + path, async (route) => {
      if (route.request().method() === "POST") {
        const response = await route.fetch();
        expect(response.ok()).toBeTruthy();
        await route.abort();
      } else await route.continue();
    });
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByLabel(field, { exact: true })).toHaveValue(title);
    await page.unroute("**" + path);
    await page.getByRole("button", { name: button, exact: true }).click();
    if (kind === "workspace") {
      await expect(
        page.getByRole("combobox", {
          name: "Текущее пространство",
          exact: true,
        }),
      ).toHaveText(title);
      await page
        .getByRole("combobox", { name: "Текущее пространство", exact: true })
        .click();
      await expect(
        page
          .getByRole("listbox")
          .getByRole("option", { name: title, exact: true }),
      ).toHaveCount(1);
    } else
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toHaveCount(1);
  });
