import { test, expect, choose } from "./audit-fixtures";

// AUD036 / FR-ASG-002 / FR-SUB-002 / UX accessibility baseline.
// Exact radio names must contain only their own option; the fieldset legend
// supplies the shared group name. A wrapping label would conflate these names.
test("choice answer has a named group and exact option labels, keyboard selection survives save and reload", async ({
  page,
  browser,
}, testInfo) => {
  const tutor = await browser.newPage();
  const title = "Доступный выбор ответа 🧪";
  const firstOption = "Обе части изменяются одинаково 🧪";
  const secondOption = "Меняется только правая часть";
  try {
    await tutor.goto("/");
    await tutor
      .getByRole("button", { name: "Я преподаватель", exact: true })
      .click();
    await tutor
      .getByRole("button", { name: "Создать задание", exact: true })
      .click();
    await tutor.getByLabel("Название работы").fill(title);
    await choose(
      tutor.getByRole("combobox", { name: "Ученик", exact: true }),
      "demo-link",
    );
    await choose(
      tutor.getByRole("combobox", { name: "Формат ответа", exact: true }),
      "single_choice",
    );
    await tutor
      .getByLabel("Условие", { exact: true })
      .fill("Какое преобразование сохраняет равенство?");
    await tutor
      .getByLabel(/Варианты \(каждый с новой строки\)/)
      .fill(firstOption + "\n" + secondOption);
    await choose(
      tutor.getByRole("combobox", { name: "Эталонный ответ", exact: true }),
      firstOption,
    );
    await tutor
      .getByLabel("Навык", { exact: true })
      .fill("Преобразование равенств");
    await tutor
      .getByRole("button", { name: "Назначить ученику", exact: true })
      .click();
    await expect(
      tutor.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();

    await page.goto("/");
    await page.getByRole("button", { name: "Я ученик", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(title) }).click();
    const group = page.getByRole("group", { name: "Ваш ответ", exact: true });
    const first = group.getByRole("radio", { name: firstOption, exact: true });
    const second = group.getByRole("radio", {
      name: secondOption,
      exact: true,
    });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio")).toHaveCount(2);
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expect(first).not.toBeChecked();
    await expect(second).not.toBeChecked();

    await first.focus();
    await first.press("Space");
    await expect(first).toBeChecked();
    await expect(second).not.toBeChecked();
    await first.press("ArrowDown");
    await expect(second).toBeFocused();
    await expect(second).toBeChecked();
    await expect(first).not.toBeChecked();
    await page
      .getByRole("button", { name: "Сохранить ответы", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Сохранено");

    await page.reload();
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio")).toHaveCount(2);
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expect(first).not.toBeChecked();
    await expect(second).toBeChecked();
    await page.screenshot({
      path: testInfo.outputPath("choice-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(group).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("choice-mobile.png"),
      fullPage: true,
    });
  } finally {
    await tutor.close();
  }
});
