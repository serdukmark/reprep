import { test, expect, choose } from "./audit-fixtures";
for (const kind of ["profile", "workspace", "group", "lesson", "material"])
  test(`${kind}: expired session refuses save visibly, retains input and never persists unauthorized changes`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    const fieldName =
      kind === "profile"
        ? "Отображаемое имя"
        : kind === "workspace"
          ? "Название пространства"
          : kind === "group"
            ? "Название группы"
            : "Название";
    const saveName =
      kind === "profile"
        ? "Сохранить имя"
        : kind === "workspace"
          ? "Создать пространство"
          : kind === "group"
            ? "Сохранить группу"
            : "Сохранить";
    const open = async () => {
      if (kind === "profile")
        await page.getByRole("button", { name: /Алекс • демо/ }).click();
      else if (["workspace", "group"].includes(kind))
        await page
          .getByRole("button", { name: "Ученики", exact: true })
          .click();
      else {
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
      }
    };
    await open();
    const title = "Не сохранено после отзыва " + kind;
    const field = page.getByLabel(fieldName, { exact: true });
    await field.fill(title);
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
          .fill("https://example.invalid/synthetic");
    }
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
    await page.getByRole("button", { name: saveName, exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(field).toHaveValue(title);
    await page.reload();
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await open();
    if (kind === "profile") await expect(field).toHaveValue("Алекс • демо");
    else {
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toHaveCount(0);
      await expect(field).toHaveValue("");
    }
  });
