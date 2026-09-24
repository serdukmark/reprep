import { test, expect } from "./audit-fixtures";
for (const kind of ["request", "review"] as const)
  test(`catalog ${kind}: delayed response locks editable fields and duplicate action sends once`, async ({
    context,
  }) => {
    const tutor = await context.newPage(),
      learner = await context.newPage();
    await tutor.goto("/");
    await tutor
      .getByRole("button", { name: "Другой преподаватель · демо", exact: true })
      .click();
    await tutor
      .getByRole("button", { name: "Репетиторы", exact: true })
      .click();
    await tutor.getByLabel("Заголовок анкеты").fill("Проверка заявки 🧪");
    await tutor
      .getByLabel("О занятиях", { exact: true })
      .fill("Синтетические занятия для проверки каталога");
    await tutor
      .getByLabel("Предметы анкеты (каждый с новой строки)")
      .fill("Физика");
    await tutor.getByLabel("Показывать мою анкету в каталоге").check();
    await tutor
      .getByRole("button", { name: "Сохранить анкету", exact: true })
      .click();
    await expect(tutor.getByRole("status")).toHaveText("Анкета сохранена");
    await learner.goto("/");
    await learner
      .getByRole("button", { name: "Я ученик", exact: true })
      .click();
    await learner
      .getByRole("button", { name: "Репетиторы", exact: true })
      .click();
    await learner
      .getByRole("button", { name: "Оставить заявку", exact: true })
      .click();
    await learner.getByLabel("Что хотите изучать").fill("Я".repeat(1200));
    expect(
      (await learner.getByLabel("Что хотите изучать").inputValue()).length,
    ).toBe(1000);
    await learner
      .getByLabel("Что хотите изучать")
      .fill("Нужна помощь с физикой 🧪");
    if (kind === "review") {
      await learner
        .getByRole("button", { name: "Отправить заявку", exact: true })
        .click();
      await expect(tutor.getByLabel("Ответ на заявку")).toBeVisible();
      await tutor.getByLabel("Ответ на заявку").fill("Я".repeat(1200));
      expect(
        (await tutor.getByLabel("Ответ на заявку").inputValue()).length,
      ).toBe(1000);
      await tutor.getByLabel("Ответ на заявку").fill("Начнём завтра 🧪");
    }
    const page = kind === "request" ? learner : tutor;
    const field = page.getByLabel(
      kind === "request" ? "Что хотите изучать" : "Ответ на заявку",
    );
    const send = page.getByRole("button", {
      name: kind === "request" ? "Отправить заявку" : "Принять ученика",
      exact: true,
    });
    const match = (url: URL) =>
      kind === "request"
        ? /^\/api\/catalog\/[^/]+\/requests$/.test(url.pathname)
        : /^\/api\/catalog\/requests\/[^/]+\/review$/.test(url.pathname);
    let calls = 0,
      release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(match, async (r) => {
      if (r.request().method() !== "POST") return r.continue();
      calls++;
      const response = await r.fetch();
      expect(response.ok()).toBe(true);
      await gate;
      await r.fulfill({ response });
    });
    // Prevent polling from hiding the pending review before the delayed ACK arrives.
    if (kind === "review")
      await tutor.route("**/api/catalog/requests", (r) => r.abort());
    try {
      await send.dblclick();
      await expect.poll(() => calls).toBe(1);
      await expect(field).toBeDisabled();
      if (kind === "request")
        await expect(
          page.getByRole("combobox", { name: "Предмет заявки", exact: true }),
        ).toBeDisabled();
      await page.screenshot({
        path: `artifacts/deep-audit/catalog-${kind}-pending.png`,
        fullPage: true,
      });
    } finally {
      if (kind === "review") await tutor.unroute("**/api/catalog/requests");
      release();
    }
    await expect(
      page.getByText(
        kind === "request"
          ? "Ожидает решения преподавателя"
          : "Преподаватель принял заявку. Учебная связь создана.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Репетиторы", exact: true }).click();
    await expect(
      page.getByText("Нужна помощь с физикой 🧪", { exact: true }),
    ).toHaveCount(1);
    await page.screenshot({
      path: `artifacts/deep-audit/catalog-${kind}-confirmed.png`,
      fullPage: true,
    });
    if (kind === "review")
      await expect(
        learner.getByText("Ответ преподавателя: Начнём завтра 🧪", {
          exact: true,
        }),
      ).toBeVisible();
  });
