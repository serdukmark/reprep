import { test, expect, choose } from "./audit-fixtures";
import type { Locator, Page } from "@playwright/test";

// FR-SUB-002/003/004/005. Both pages log in as the same synthetic learner
// through UI; the assignment, drafts, return and every submission are UI actions.
// Current D-N02/D-N09 resubmission assumption, not a new retry/deadline policy.
// Contract: after an original exists, identical content returns that submission
// ID; different content is rejected before the stale draft revision is checked.
type Answers = [string, string, string];
const correctChoice = "Одинаковое действие над обеими частями 🧪";
const otherChoice = "Изменить только одну часть";
const originalAnswers: Answers = [
  "4",
  otherChoice,
  "Первый оригинал: Ё, <текст> & объяснение 🧪\nСохранить без изменений.",
];
function boundaryText(prefix: string) {
  // maxLength is measured in UTF-16 code units in this textarea. Padding with
  // a BMP character avoids cutting an emoji's surrogate pair at the boundary.
  return prefix + "Ж".repeat(5000 - prefix.length);
}
const winningAnswers: Answers = [
  "5",
  correctChoice,
  boundaryText("Побеждающий оригинал 🧪\nЁ, <текст> & 2 + 3 = 5. "),
];
const differentAnswers: Answers = [
  "6",
  otherChoice,
  boundaryText("Прежний ответ другой вкладки 🧪\nОн не должен заменить победителя. "),
];

async function login(page: Page, role: string) {
  await page.goto("/");
  await page.getByRole("button", { name: role, exact: true }).click();
}

async function openWork(page: Page, title: string) {
  const row = page.getByRole("button", { name: new RegExp(title) });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

async function createWork(tutor: Page, title: string) {
  await tutor.getByRole("button", { name: "Создать задание", exact: true }).click();
  await tutor.getByLabel("Название работы").fill(title);
  await choose(tutor.getByRole("combobox", { name: "Ученик", exact: true }), "demo-link");
  const tasks = tutor.locator(".task-editor");
  await tasks.nth(0).getByLabel("Условие", { exact: true }).fill("Сколько будет 2 + 3?");
  await tasks.nth(0).getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await tasks.nth(0).getByLabel("Навык", { exact: true }).fill("Сложение");
  await tutor.getByRole("button", { name: "Добавить задание", exact: true }).click();
  await choose(tasks.nth(1).getByRole("combobox", { name: "Формат ответа", exact: true }), "single_choice");
  await tasks.nth(1).getByLabel("Условие", { exact: true }).fill("Какое действие сохраняет равенство?");
  await tasks.nth(1).getByLabel(/Варианты \(каждый с новой строки\)/).fill(correctChoice + "\n" + otherChoice);
  await choose(tasks.nth(1).getByRole("combobox", { name: "Эталонный ответ", exact: true }), correctChoice);
  await tasks.nth(1).getByLabel("Навык", { exact: true }).fill("Выбор преобразования");
  await tutor.getByRole("button", { name: "Добавить задание", exact: true }).click();
  await choose(tasks.nth(2).getByRole("combobox", { name: "Формат ответа", exact: true }), "short_text");
  await tasks.nth(2).getByLabel("Условие", { exact: true }).fill("Объясните, почему одинаковое преобразование сохраняет равенство.");
  await tasks.nth(2).getByLabel("Критерии проверки", { exact: true }).fill("Объяснение одинакового преобразования обеих частей равенства.");
  await tasks.nth(2).getByLabel("Навык", { exact: true }).fill("Объяснение равенства");
  const created = tutor.waitForResponse(response =>
    new URL(response.url()).pathname === "/api/assignments" && response.request().method() === "POST",
  );
  await tutor.getByRole("button", { name: "Назначить ученику", exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const work: { id: string; relationship_id: string } = await response.json();
  expect(work.relationship_id).toBe("demo-link");
  await expect(tutor.getByRole("heading", { name: title, exact: true })).toBeVisible();
  return work.id;
}

async function saveAnswers(page: Page, answers: Answers) {
  await page.getByLabel("Ответ на задание 1").fill(answers[0]);
  await page.getByRole("radio", { name: answers[1], exact: true }).check();
  await page.getByLabel("Ответ на задание 3").fill(answers[2]);
  await page.getByRole("button", { name: "Сохранить ответы", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Сохранено");
}

async function assertAnswers(page: Page, answers: Answers) {
  await expect(page.getByLabel("Ответ на задание 1")).toHaveValue(answers[0]);
  await expect(page.getByRole("radio", { name: answers[1], exact: true })).toBeChecked();
  await expect(page.getByLabel("Ответ на задание 3")).toHaveValue(answers[2]);
}

async function assertOriginals(originals: Locator, answers: Answers) {
  await expect(originals).toHaveCount(3);
  for (const [index, answer] of answers.entries())
    await expect(originals.nth(index)).toHaveJSProperty("textContent", answer);
}

async function clickSubmit(page: Page) {
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Отправить работу", exact: true }).click();
}

async function submitResponse(page: Page, assignment: string) {
  const response = page.waitForResponse(reply =>
    new URL(reply.url()).pathname === `/api/assignments/${assignment}/submit` && reply.request().method() === "POST",
  );
  await clickSubmit(page);
  return response;
}

async function assertHistory(page: Page, assignment: string, attempts: Answers[]) {
  const history = page.locator(".attempt-history");
  const loaded = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/assignments/${assignment}/attempts` && response.request().method() === "GET",
  );
  await history.getByRole("button", { name: "История попыток", exact: true }).click();
  expect((await loaded).status()).toBe(200);
  await expect(history.getByRole("status")).toHaveCount(0);
  await expect(history.getByRole("alert")).toHaveCount(0);
  await expect(history.locator(".assignment-row")).toHaveCount(attempts.length);
  for (const [index, answers] of attempts.entries()) {
    await history.getByRole("button", { name: new RegExp(`^Попытка ${index + 1} `) }).click();
    await assertOriginals(history.locator(".attempt-detail .original p"), answers);
  }
}

for (const phase of ["first", "returned"] as const)
  for (const content of ["same", "different"] as const)
    test(`same learner ${phase} submission with ${content} answers: a lost winner acknowledgement never adds or rewrites an original`, async ({ page, browser }) => {
      const tutor = await browser.newPage();
      const second = await browser.newPage();
      const title = `Две вкладки одного ученика ${phase} ${content} 🧪`;
      let release: (() => void) | undefined;
      try {
        expect(winningAnswers[2].length).toBe(5000);
        expect(differentAnswers[2].length).toBe(5000);
        await login(tutor, "Я преподаватель");
        const assignment = await createWork(tutor, title);
        await login(page, "Я ученик");
        await openWork(page, title);
        let firstSubmissionId = "";
        if (phase === "returned") {
          await saveAnswers(page, originalAnswers);
          const first = await submitResponse(page, assignment);
          expect(first.status()).toBe(200);
          firstSubmissionId = (await first.json()).id;
          await assertOriginals(page.locator(".work-task .original p"), originalAnswers);
          await tutor.reload();
          await openWork(tutor, title);
          await tutor.getByLabel("Комментарий к работе").fill("Дополните ответ; предыдущий оригинал сохраняется 🧪");
          await tutor.getByRole("button", { name: "Вернуть на доработку", exact: true }).click();
          await expect(tutor.getByText(/Преподаватель вернул работу:/)).toBeVisible();
          await page.reload();
          await openWork(page, title);
          await assertAnswers(page, originalAnswers);
          // A selected radio has no UI action to deselect all options. Empty
          // numeric/text fields are the incomplete resubmission under test.
          await page.getByLabel("Ответ на задание 1").fill("");
          await page.getByLabel("Ответ на задание 3").fill("");
          const empty = await submitResponse(page, assignment);
          expect(empty.status()).toBe(422);
          expect((await empty.json()).error.code).toBe("INCOMPLETE");
          await expect(page.getByRole("alert").filter({ hasText: "Ответьте на все задания перед отправкой" })).toBeVisible();
          await expect(page.getByLabel("Ответ на задание 1")).toHaveValue("");
          await expect(page.getByLabel("Ответ на задание 3")).toHaveValue("");
          await expect(page.getByRole("radio", { name: originalAnswers[1], exact: true })).toBeChecked();
        }

        const secondAnswers = content === "same" ? winningAnswers : differentAnswers;
        await saveAnswers(page, secondAnswers);
        await login(second, "Я ученик");
        await openWork(second, title);
        await assertAnswers(second, secondAnswers);
        if (content === "different") {
          // The second tab keeps its genuinely loaded old draft/revision.
          // The first tab saves the winner afterwards; no autosave is blocked
          // and no fake GET response is needed to create a stale editor.
          await saveAnswers(page, winningAnswers);
        }
        await assertAnswers(page, winningAnswers);
        await expect(page.getByLabel("Ответ на задание 3")).toHaveAttribute("maxlength", "5000");
        if (phase === "returned") {
          await tutor.reload();
          await openWork(tutor, title);
          await assertHistory(tutor, assignment, [originalAnswers]);
        }

        const held = new Promise<void>(resolve => { release = resolve; });
        const path = `**/api/assignments/${assignment}/submit`;
        let winningSubmissionId = "";
        let winnerRequests = 0;
        await page.route(path, async route => {
          winnerRequests++;
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          winningSubmissionId = (await response.json()).id;
          await held;
          await route.abort("connectionreset");
        });
        await clickSubmit(page);
        await expect.poll(() => winningSubmissionId).not.toBe("");
        expect(winnerRequests).toBe(1);
        if (phase === "returned") expect(winningSubmissionId).not.toBe(firstSubmissionId);
        await expect(page.getByRole("button", { name: "Отправить работу", exact: true })).toBeDisabled();

        // Second UI action arrives while the first UI action is still pending,
        // after the server has committed its immutable original.
        const competing = await submitResponse(second, assignment);
        expect(competing.status()).toBe(content === "same" ? 200 : 409);
        if (content === "same") {
          expect((await competing.json()).id).toBe(winningSubmissionId);
          await assertOriginals(second.locator(".work-task .original p"), winningAnswers);
        } else {
          expect((await competing.json()).error.code).toBe("ALREADY_SUBMITTED");
          await expect(second.getByRole("alert").filter({ hasText: "Уже отправлена другая версия ответов" })).toBeVisible();
          await assertAnswers(second, differentAnswers);
          await expect(second.getByRole("button", { name: "Отправить работу", exact: true })).toBeEnabled();
          await expect(second.getByText("Ответы сохранены и отправлены.", { exact: false })).toHaveCount(0);
        }
        release?.();
        await expect(page.getByRole("alert").filter({ hasText: "Не удалось связаться с сервером" })).toBeVisible();
        await assertAnswers(page, winningAnswers);
        await expect(page.getByText("Ответы сохранены и отправлены.", { exact: false })).toHaveCount(0);
        await page.unroute(path);

        const retried = await submitResponse(page, assignment);
        expect(retried.status()).toBe(200);
        expect((await retried.json()).id).toBe(winningSubmissionId);
        await assertOriginals(page.locator(".work-task .original p"), winningAnswers);
        const attempts = phase === "returned" ? [originalAnswers, winningAnswers] : [winningAnswers];
        for (const reader of [page, second, tutor]) {
          await reader.reload();
          await openWork(reader, title);
          await assertOriginals(reader.locator(".work-task .original p"), winningAnswers);
          await assertHistory(reader, assignment, attempts);
        }
      } finally {
        release?.();
        await tutor.close();
        await second.close();
      }
    });
