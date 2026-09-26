import { test, expect, choose } from "./audit-fixtures";
import type { Browser, Page } from "@playwright/test";

const tasks = [
  {
    type: "numeric",
    label: "Число",
    prompt: "Вычисли 25 ÷ 2. Запиши число 🧮 <проверка> & Ё.",
    answer: "12,5",
    skill: "Деление 🧮",
    rubric: "ЛИЧНЫЙ КРИТЕРИЙ №1: допустима десятичная запятая 🗝️.",
    hint: "Раздели сначала 24, затем оставшуюся единицу.",
    options: [],
  },
  {
    type: "single_choice",
    label: "Один вариант",
    prompt: "Выбери запись с правильным равенством 🧩 <сравни> & Ё.",
    answer: "Два плюс три = пять 🟢",
    skill: "Выбор равенства 🧩",
    rubric: "ЛИЧНЫЙ КРИТЕРИЙ №2: ровно один вариант 🗝️.",
    hint: "Проверь каждую сумму по очереди.",
    options: [
      "Два плюс три = шесть 🔴",
      "Два плюс три = пять 🟢",
      "Два плюс три = семь 🟡",
    ],
  },
  {
    type: "short_text",
    label: "Короткий ответ с объяснением",
    prompt:
      "Почему обе части равенства делят на одно число? Объясни 📝 <шаг> & Ё.",
    answer: "ЭТАЛОН ТОЛЬКО УЧИТЕЛЮ: равные части остаются равными 🗝️.",
    skill: "Рассуждение 📝",
    rubric:
      "ЛИЧНЫЙ КРИТЕРИЙ №3: названо одинаковое действие над обеими частями 🗝️.",
    hint: "Вспомни равновесие весов и одинаковое действие.",
    options: [],
  },
] as const;
const instructions =
  "Три разных формата 🧪 <текст> & Ё.\nСначала подумай, затем ответь.";

async function login(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Я преподаватель", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Создать задание", exact: true }),
  ).toBeVisible();
}

async function fillDraft(page: Page, title: string) {
  await page
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await expect(page.getByLabel("Название работы")).toHaveValue("");
  await page.getByLabel("Название работы").fill(title);
  await choose(
    page.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  await page.getByLabel("Инструкция ученику").fill(instructions);
  for (const [index, task] of tasks.entries()) {
    if (index)
      await page
        .getByRole("button", { name: "Добавить задание", exact: true })
        .click();
    const editor = page.locator(".task-editor").nth(index);
    await choose(
      editor.getByRole("combobox", { name: "Формат ответа", exact: true }),
      task.type,
    );
    await editor
      .getByRole("textbox", { name: "Условие", exact: true })
      .fill(task.prompt);
    if (task.type === "single_choice") {
      await editor.getByLabel(/Варианты/).fill(task.options.join("\n"));
      await choose(
        editor.getByRole("combobox", { name: "Эталонный ответ", exact: true }),
        task.answer,
      );
    } else
      await editor
        .getByLabel("Эталонный ответ", { exact: true })
        .fill(task.answer);
    await editor.getByLabel("Навык", { exact: true }).fill(task.skill);
    await editor
      .getByRole("textbox", { name: "Критерии проверки", exact: true })
      .fill(task.rubric);
    await editor
      .getByLabel("Подсказка ученику (без готового ответа)", { exact: true })
      .fill(task.hint);
  }
}

async function verifyEditor(page: Page, title: string) {
  await expect(page.getByLabel("Название работы")).toHaveValue(title);
  await expect(page.getByLabel("Инструкция ученику")).toHaveValue(instructions);
  await expect(
    page.getByRole("combobox", { name: "Ученик", exact: true }),
  ).toContainText("Саша • демо");
  await expect(page.locator(".task-editor")).toHaveCount(3);
  for (const [index, task] of tasks.entries()) {
    const editor = page.locator(".task-editor").nth(index);
    await expect(
      editor.getByRole("combobox", { name: "Формат ответа", exact: true }),
    ).toHaveText(task.label);
    // getByLabel uses the wrapping label's DOM text, including the filled
    // textarea's text node. Its accessible textbox name remains just "Условие".
    await expect(
      editor.getByRole("textbox", { name: "Условие", exact: true }),
    ).toHaveValue(task.prompt);
    if (task.type === "single_choice") {
      await expect(editor.getByLabel(/Варианты/)).toHaveValue(
        task.options.join("\n"),
      );
      await expect(
        editor.getByRole("combobox", { name: "Эталонный ответ", exact: true }),
      ).toHaveText(task.answer);
    } else
      await expect(
        editor.getByLabel("Эталонный ответ", { exact: true }),
      ).toHaveValue(task.answer);
    await expect(editor.getByLabel("Навык", { exact: true })).toHaveValue(
      task.skill,
    );
    await expect(
      editor.getByRole("textbox", { name: "Критерии проверки", exact: true }),
    ).toHaveValue(task.rubric);
    await expect(
      editor.getByLabel("Подсказка ученику (без готового ответа)", {
        exact: true,
      }),
    ).toHaveValue(task.hint);
  }
}

async function listWork(page: Page, title: string) {
  await page.getByRole("button", { name: "Задания", exact: true }).click();
  await page.getByPlaceholder("Найти задание").fill(title);
}

async function revokeFromOtherPage(page: Page, browser: Browser) {
  const revoker = await browser.newPage();
  try {
    const token = await page.evaluate(() =>
      sessionStorage.getItem("reprep.session"),
    );
    expect(Boolean(token)).toBe(true);
    await revoker.addInitScript(
      (value) => sessionStorage.setItem("reprep.session", value!),
      token,
    );
    await revoker.goto("/");
    await revoker.getByRole("button", { name: /Алекс • демо/ }).click();
    const revoked = revoker.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/logout" &&
        r.request().method() === "POST",
    );
    await revoker.getByRole("button", { name: "Выйти", exact: true }).click();
    expect((await revoked).status()).toBe(200);
    await expect(
      revoker.getByRole("button", { name: "Я преподаватель", exact: true }),
    ).toBeVisible();
  } finally {
    await revoker.close();
  }
}

async function verifyPrivateReferencesAbsent(page: Page) {
  await expect(page.locator(".private-fields, .reference")).toHaveCount(0);
  await expect(page.getByText("12,5", { exact: true })).toHaveCount(0);
  await expect(page.getByText(tasks[2].answer, { exact: true })).toHaveCount(0);
  for (const task of tasks)
    await expect(page.getByText(task.rubric, { exact: true })).toHaveCount(0);
}

for (const failure of [
  "before-delivery",
  "lost-ack",
  "expired-session",
] as const)
  test(`three task types draft ${failure}: exact input survives failure, one durable draft can be previewed and assigned`, async ({
    page,
    browser,
  }) => {
    const title = `Три формата 🧪 <Ё> & ${failure}`;
    const observer = await browser.newPage(),
      learner = await browser.newPage();
    const path = "**/api/assignments";
    let intercepted = 0;
    try {
      await login(page);
      await fillDraft(page, title);
      if (failure === "expired-session")
        await revokeFromOtherPage(page, browser);
      else
        await page.route(path, async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          intercepted++;
          if (failure === "lost-ack") {
            // Deliver the actual UI request and commit it, then drop only its
            // acknowledgement. No invented response or separate fixture write.
            const response = await route.fetch();
            expect(response.status()).toBe(201);
          }
          await route.abort("connectionfailed");
        });
      const denied =
        failure === "expired-session"
          ? page.waitForResponse(
              (r) =>
                new URL(r.url()).pathname === "/api/assignments" &&
                r.request().method() === "POST",
            )
          : null;
      await page
        .getByRole("button", { name: "Сохранить черновик", exact: true })
        .click();
      if (denied) expect((await denied).status()).toBe(401);
      await expect(page.getByRole("alert").first()).toContainText(
        failure === "expired-session"
          ? "Сессия завершилась. Войдите снова"
          : "Не удалось связаться с сервером",
      );
      if (failure !== "expired-session") expect(intercepted).toBe(1);
      await verifyEditor(page, title);
      await expect(
        page.getByText("Черновик сохранён", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toHaveCount(0);

      // Editing remains usable after the failure. Add and remove a fourth task,
      // then verify the original three retain every field before retrying.
      await page
        .getByRole("button", { name: "Добавить задание", exact: true })
        .click();
      await expect(page.locator(".task-editor")).toHaveCount(4);
      await page
        .locator(".task-editor")
        .nth(3)
        .getByRole("textbox", { name: "Условие", exact: true })
        .fill("Временное задание 🧪 — удалить до сохранения");
      await page
        .getByRole("button", { name: "Удалить задание 4", exact: true })
        .click();
      await verifyEditor(page, title);

      // A separate authenticated UI distinguishes failed delivery from a
      // committed draft whose acknowledgement never reached the editor.
      await login(observer);
      await listWork(observer, title);
      await expect(observer.locator(".assignment-row")).toHaveCount(
        failure === "lost-ack" ? 1 : 0,
      );
      if (failure === "lost-ack")
        await expect(observer.locator(".assignment-row")).toContainText(
          "Черновик",
        );
      if (failure === "expired-session") {
        page.once("dialog", (dialog) => dialog.accept());
        await page.reload();
        await page
          .getByRole("button", { name: "Я преподаватель", exact: true })
          .click();
        await listWork(page, title);
        await expect(page.locator(".assignment-row")).toHaveCount(0);
        // Reload deliberately discards the unsaved form. Re-enter every field
        // through the UI; this test does not claim client-side draft recovery.
        await fillDraft(page, title);
      } else await page.unroute(path);
      await page
        .getByRole("button", { name: "Сохранить черновик", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Черновик сохранён", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await listWork(page, title);
      await expect(page.locator(".assignment-row")).toHaveCount(1);
      await expect(page.locator(".assignment-row")).toContainText("Черновик");
      await page.locator(".assignment-row").click();
      await expect(page.locator(".work-task")).toHaveCount(3);
      await page
        .getByRole("button", { name: "Редактировать", exact: true })
        .click();
      await verifyEditor(page, title);

      await page
        .getByRole("button", { name: "Глазами ученика", exact: true })
        .click();
      await expect(page.locator(".task-editor")).toHaveCount(3);
      for (const task of tasks)
        await expect(
          page.getByRole("heading", { name: task.prompt, exact: true }),
        ).toBeVisible();
      await expect(
        page.locator(".task-editor").nth(1).locator(".option"),
      ).toHaveText([...tasks[1].options]);
      await expect(
        page.locator(".task-editor").nth(1).locator(".chosen"),
      ).toHaveCount(0);
      await verifyPrivateReferencesAbsent(page);
      await page
        .getByRole("button", { name: "Вернуться к редактору", exact: true })
        .click();
      await verifyEditor(page, title);
      await page
        .getByRole("button", { name: "Назначить ученику", exact: true })
        .click();
      await expect(
        page.getByText("Работа назначена ученику", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Создать копию", exact: true }),
      ).toBeVisible();
      await page.reload();
      await listWork(page, title);
      await expect(page.locator(".assignment-row")).toHaveCount(1);
      await expect(page.locator(".assignment-row")).toContainText("Назначено");

      await learner.goto("/");
      await learner
        .getByRole("button", { name: "Я ученик", exact: true })
        .click();
      await listWork(learner, title);
      await expect(learner.locator(".assignment-row")).toHaveCount(1);
      await learner.locator(".assignment-row").click();
      await expect(learner.locator(".work-task")).toHaveCount(3);
      await expect(learner.locator(".instructions")).toHaveText(instructions);
      for (const task of tasks)
        await expect(
          learner.getByRole("heading", { name: task.prompt, exact: true }),
        ).toBeVisible();
      await expect(
        learner.getByLabel("Ответ на задание 1", { exact: true }),
      ).toHaveAttribute("placeholder", "Введите число");
      await expect(
        learner.getByLabel("Ответ на задание 3", { exact: true }),
      ).toHaveAttribute("placeholder", "Напишите ответ и ход рассуждений");
      await expect(
        learner.locator(".work-task").nth(1).getByRole("radio"),
      ).toHaveCount(3);
      for (const option of tasks[1].options) {
        await expect(
          learner.getByRole("radio", { name: option, exact: true }),
        ).toBeVisible();
        await expect(
          learner.getByRole("radio", { name: option, exact: true }),
        ).not.toBeChecked();
      }
      await verifyPrivateReferencesAbsent(learner);
    } finally {
      await observer.close();
      await learner.close();
    }
  });
