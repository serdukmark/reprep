import { test, expect } from "./audit-fixtures";
for (const kind of ["workspace", "lesson", "material"])
  test(`${kind}: leaving a filled unsaved form asks before discarding it`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    const open = async () => {
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
    };
    await open();
    const field = page.getByLabel(
      kind === "workspace" ? "Название пространства" : "Название",
      { exact: true },
    );
    await field.fill("Важный несохранённый ввод 🧪");
    let asked = 0;
    page.once("dialog", async (d) => {
      asked++;
      await d.dismiss();
    });
    await page.getByRole("button", { name: "Сегодня", exact: true }).click();
    expect(asked).toBe(1);
    await expect(field).toHaveValue("Важный несохранённый ввод 🧪");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Сегодня", exact: true }).click();
    await expect(field).toHaveCount(0);
    await open();
    await expect(field).toHaveValue("");
  });
