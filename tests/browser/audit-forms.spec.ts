import { test, expect, choose } from "./audit-fixtures";

for (const kind of ["profile", "workspace", "group", "lesson", "material"]) {
  test(`${kind}: blank and long input, Unicode, offline retry, double click and reload`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    let field = "",
      submit = "",
      path = "",
      limit = 100;
    async function open() {
      if (kind === "profile") {
        await page
          .getByRole("button", { name: /Алекс • демо|Аудит 🧪/ })
          .click();
        field = "Отображаемое имя";
        submit = "Сохранить имя";
        path = "/api/profile";
        limit = 60;
      }
      if (["workspace", "group"].includes(kind)) {
        await page
          .getByRole("button", { name: "Ученики", exact: true })
          .click();
        field =
          kind === "workspace" ? "Название пространства" : "Название группы";
        submit =
          kind === "workspace" ? "Создать пространство" : "Сохранить группу";
        path = kind === "workspace" ? "/api/workspaces" : "/api/groups";
      }
      if (["lesson", "material"].includes(kind)) {
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
        submit = "Сохранить";
        path = kind === "lesson" ? "/api/lessons" : "/api/materials";
        limit = 160;
      }
    }
    await open();
    const input = page.getByLabel(field, { exact: true });
    const save = page.getByRole("button", { name: submit, exact: true });
    let sent = 0;
    page.on("request", (r) => {
      if (
        r.url().endsWith(path) &&
        ["POST", "PATCH", "PUT"].includes(r.method())
      )
        sent++;
    });
    await input.fill("");
    if (kind === "group") {
      await expect(save).toBeDisabled();
      await page.getByRole("checkbox", { name: /Саша • демо/ }).check();
    }
    await save.click();
    expect(sent).toBe(0);
    await input.fill("Я".repeat(2000));
    expect((await input.inputValue()).length).toBeLessThanOrEqual(limit);
    const title = "Аудит 🧪 <script> & Ё " + kind;
    await input.fill(title);
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
          .fill("2026-12-31T17:00");
      else
        await page
          .getByLabel("Ссылка HTTPS")
          .fill("https://example.org/synthetic");
    }
    await page.route("**" + path, (r) =>
      ["POST", "PUT", "PATCH"].includes(r.request().method())
        ? r.abort()
        : r.continue(),
    );
    await save.click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(input).toHaveValue(title);
    await page.unroute("**" + path);
    sent = 0;
    await save.dblclick();
    if (kind === "profile")
      await expect(
        page.getByText("Имя сохранено", { exact: true }),
      ).toBeVisible();
    else if (kind === "workspace")
      await expect(
        page.getByRole("combobox", {
          name: "Текущее пространство",
          exact: true,
        }),
      ).toHaveText(title);
    else if (kind === "group")
      await expect(
        page.getByText("Группа сохранена", { exact: true }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
    expect(sent).toBe(1);
    await page.reload();
    if (kind === "profile") {
      await open();
      await expect(page.getByLabel(field, { exact: true })).toHaveValue(title);
    } else {
      await page
        .getByRole("button", {
          name: ["workspace", "group"].includes(kind)
            ? "Ученики"
            : kind === "lesson"
              ? "Расписание"
              : "Материалы",
          exact: true,
        })
        .click();
      if (kind === "workspace")
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
    }
  });
}
