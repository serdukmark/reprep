import { test, expect, choose } from "./audit-fixtures";
import type { Page, Locator } from "@playwright/test";

// FR-SUB-002/003/004/005: first submission and resubmission across a real
// server-side session revocation. UI creates the work and every answer.
// The only session manipulation copies the synthetic token to a second page,
// whose ordinary logout invalidates that token for both pages.
type Answers = [string, string, string];
const firstAnswers: Answers = [
  "4",
  "Изменить одну сторону",
  "Первая попытка: объяснение ученика Ё 🧪\nОригинал нельзя переписать.",
];
const finalAnswers: Answers = [
  "5",
  "Сохранить равенство 🧪",
  "Исправленный ответ: одинаковое действие над обеими частями 🧪\nЁ, <текст> & 2 + 3 = 5.",
];

async function login(page: Page, role: string) {
  await page.goto("/");
  await page.getByRole("button", { name: role, exact: true }).click();
}

async function openWork(page: Page, title: string) {
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

async function createWork(tutor: Page, title: string) {
  await tutor
    .getByRole("button", { name: "Создать задание", exact: true })
    .click();
  await tutor.getByLabel("Название работы").fill(title);
  await choose(
    tutor.getByRole("combobox", { name: "Ученик", exact: true }),
    "demo-link",
  );
  const editors = tutor.locator(".task-editor");
  await editors
    .nth(0)
    .getByLabel("Условие", { exact: true })
    .fill("Сколько будет 2 + 3?");
  await editors.nth(0).getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await editors.nth(0).getByLabel("Навык", { exact: true }).fill("Сложение");
  await tutor
    .getByRole("button", { name: "Добавить задание", exact: true })
    .click();
  await choose(
    editors
      .nth(1)
      .getByRole("combobox", { name: "Формат ответа", exact: true }),
    "single_choice",
  );
  await editors
    .nth(1)
    .getByLabel("Условие", { exact: true })
    .fill("Какова цель одинакового преобразования обеих частей?");
  await editors
    .nth(1)
    .getByLabel(/Варианты \(каждый с новой строки\)/)
    .fill(finalAnswers[1] + "\n" + firstAnswers[1]);
  await choose(
    editors
      .nth(1)
      .getByRole("combobox", { name: "Эталонный ответ", exact: true }),
    finalAnswers[1],
  );
  await editors
    .nth(1)
    .getByLabel("Навык", { exact: true })
    .fill("Выбор преобразования");
  await tutor
    .getByRole("button", { name: "Добавить задание", exact: true })
    .click();
  await choose(
    editors
      .nth(2)
      .getByRole("combobox", { name: "Формат ответа", exact: true }),
    "short_text",
  );
  await editors
    .nth(2)
    .getByLabel("Условие", { exact: true })
    .fill("Объясните, почему одинаковое преобразование сохраняет равенство.");
  await editors
    .nth(2)
    .getByLabel("Критерии проверки", { exact: true })
    .fill("Объяснение одинакового преобразования обеих частей равенства.");
  await editors
    .nth(2)
    .getByLabel("Навык", { exact: true })
    .fill("Объяснение равенства");
  const created = tutor.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/assignments" &&
      response.request().method() === "POST",
  );
  await tutor
    .getByRole("button", { name: "Назначить ученику", exact: true })
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  const work: { id: string; relationship_id: string } = await response.json();
  expect(work.relationship_id).toBe("demo-link");
  await expect(
    tutor.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  return work.id;
}

async function saveAnswers(page: Page, answers: Answers) {
  await page.getByLabel("Ответ на задание 1").fill(answers[0]);
  await page.getByRole("radio", { name: answers[1], exact: true }).check();
  await page.getByLabel("Ответ на задание 3").fill(answers[2]);
  await page
    .getByRole("button", { name: "Сохранить ответы", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Сохранено");
}

async function assertAnswers(page: Page, answers: Answers) {
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue(answers[0]);
  await expect(
    page.getByRole("radio", { name: answers[1], exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Ответ на задание 3")).toHaveValue(answers[2]);
}

async function assertOriginals(originals: Locator, answers: Answers) {
  await expect(originals).toHaveCount(3);
  for (const [index, answer] of answers.entries()) {
    // Exact DOM text preserves the newline and all Unicode, not just a prefix.
    await expect(originals.nth(index)).toHaveJSProperty("textContent", answer);
  }
}

async function submit(page: Page, assignment: string, status: number) {
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === `/api/assignments/${assignment}/submit` &&
      r.request().method() === "POST",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Отправить работу", exact: true })
    .click();
  expect((await response).status()).toBe(status);
}

async function assertHistory(
  page: Page,
  assignment: string,
  attempts: Answers[],
) {
  const toggle = page.getByRole("button", { name: /^История попыток/ });
  if (!attempts.length) {
    // The product intentionally omits history until a first original exists.
    await expect(toggle).toHaveCount(0);
    await expect(page.locator(".work-task .original")).toHaveCount(0);
    return;
  }
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    const loaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/assignments/${assignment}/attempts` &&
        response.request().method() === "GET",
    );
    await toggle.click();
    const response = await loaded;
    expect(response.status()).toBe(200);
    await response.finished();
  }
  const history = page.locator(".attempt-history");
  await expect(history.getByRole("status")).toHaveCount(0);
  await expect(history.getByRole("alert")).toHaveCount(0);
  await expect(history.locator(".assignment-row")).toHaveCount(attempts.length);
  for (const [index, answers] of attempts.entries()) {
    await history
      .getByRole("button", { name: new RegExp(`^Попытка ${index + 1} `) })
      .click();
    await assertOriginals(
      history.locator(".attempt-detail .original p"),
      answers,
    );
  }
}

for (const mode of ["first submission", "returned submission"] as const)
  test(`learner ${mode}: UI-revoked session refuses submission, keeps all saved answers and fresh login creates one attempt`, async ({
    page,
    browser,
  }) => {
    const tutor = await browser.newPage();
    const revoker = await browser.newPage();
    const title = `Сдача после отзыва сессии ${mode} 🧪`;
    const returned = mode === "returned submission";
    try {
      await login(tutor, "Я преподаватель");
      const assignment = await createWork(tutor, title);
      await login(page, "Я ученик");
      await openWork(page, title);
      if (returned) {
        await saveAnswers(page, firstAnswers);
        await submit(page, assignment, 200);
        await assertOriginals(
          page.locator(".work-task .original p"),
          firstAnswers,
        );
        await tutor.reload();
        await openWork(tutor, title);
        await tutor
          .getByLabel("Комментарий к работе")
          .fill("Проверьте ответы и дополните пояснение 🧪");
        await tutor
          .getByRole("button", { name: "Вернуть на доработку", exact: true })
          .click();
        await expect(
          tutor.getByText(/Преподаватель вернул работу:/),
        ).toBeVisible();
        await page.reload();
        await openWork(page, title);
        await assertAnswers(page, firstAnswers);
      }
      // Saving before revocation makes the recovery contract explicit: reload
      // restores the server draft; this test does not claim unsaved persistence.
      await saveAnswers(page, finalAnswers);
      await assertAnswers(page, finalAnswers);
      const token = await page.evaluate(() =>
        sessionStorage.getItem("reprep.session"),
      );
      expect(Boolean(token)).toBe(true);
      await revoker.addInitScript(
        (value) => sessionStorage.setItem("reprep.session", value!),
        token,
      );
      await revoker.goto("/");
      await revoker.getByRole("button", { name: /Саша • демо/ }).click();
      const revoked = revoker.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/logout" &&
          response.request().method() === "POST",
      );
      await revoker.getByRole("button", { name: "Выйти", exact: true }).click();
      expect((await revoked).status()).toBe(200);
      await expect(
        revoker.getByRole("button", { name: "Я ученик", exact: true }),
      ).toBeVisible();

      await submit(page, assignment, 401);
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Сессия завершилась. Войдите снова" })
          .first(),
      ).toBeVisible();
      await assertAnswers(page, finalAnswers);
      await expect(
        page.getByRole("button", { name: "Отправить работу", exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByText("Ответы сохранены и отправлены.", { exact: false }),
      ).toHaveCount(0);
      // The unaffected tutor session verifies persisted originals through UI.
      // A rejected first submit has neither history nor an original; a rejected
      // repeat still has exactly the first immutable attempt, with all 3 answers.
      await tutor.reload();
      await openWork(tutor, title);
      await assertHistory(tutor, assignment, returned ? [firstAnswers] : []);
      if (returned)
        await expect(
          tutor.getByText(/Преподаватель вернул работу:/),
        ).toBeVisible();
      await assertAnswers(page, finalAnswers);

      await page.reload();
      await expect(
        page.getByRole("button", { name: "Я ученик", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Я ученик", exact: true }).click();
      await openWork(page, title);
      await assertAnswers(page, finalAnswers);
      await submit(page, assignment, 200);
      await expect(page.getByLabel("Ответ на задание 1")).toHaveCount(0);
      await expect(
        page.getByText("Ответы сохранены и отправлены.", { exact: false }),
      ).toBeVisible();
      await page.reload();
      await openWork(page, title);
      await assertOriginals(
        page.locator(".work-task .original p"),
        finalAnswers,
      );
      const attempts = returned ? [firstAnswers, finalAnswers] : [finalAnswers];
      await assertHistory(page, assignment, attempts);
      await tutor.reload();
      await openWork(tutor, title);
      await assertOriginals(
        tutor.locator(".work-task .original p"),
        finalAnswers,
      );
      await assertHistory(tutor, assignment, attempts);
    } finally {
      await tutor.close();
      await revoker.close();
    }
  });
