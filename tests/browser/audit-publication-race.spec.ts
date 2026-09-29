import { test, expect, choose } from "./audit-fixtures";
import type { Page } from "@playwright/test";

const instructions = "Публикация трёх форматов 🧪\nУсловия остаются неизменными.";
const tasks = [
  { type: "numeric", prompt: "Вычисли 31 + 11 🧮", answer: "42", skill: "Сложение", rubric: "Личный критерий числа 🗝️", options: [] },
  { type: "single_choice", prompt: "Выбери верное равенство 🧩", answer: "2 + 3 = 5", skill: "Равенство", rubric: "Личный критерий выбора 🗝️", options: ["2 + 3 = 4", "2 + 3 = 5", "2 + 3 = 6"] },
  { type: "short_text", prompt: "Объясни сохранение равенства 📝", answer: "Личный эталон объяснения 🗝️", skill: "Рассуждение", rubric: "Личный критерий объяснения 🗝️", options: [] },
] as const;

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function login(page: Page, learner = false) {
  await page.goto("/");
  await page.getByRole("button", { name: learner ? "Я ученик" : "Я преподаватель", exact: true }).click();
}

async function createDraft(page: Page, title: string) {
  await page.getByRole("button", { name: "Создать задание", exact: true }).click();
  await page.getByLabel("Название работы").fill(title);
  await page.getByLabel("Инструкция ученику").fill(instructions);
  await choose(page.getByRole("combobox", { name: "Ученик", exact: true }), "demo-link");
  for (const [index, task] of tasks.entries()) {
    if (index) await page.getByRole("button", { name: "Добавить задание", exact: true }).click();
    const editor = page.locator(".task-editor").nth(index);
    await choose(editor.getByRole("combobox", { name: "Формат ответа", exact: true }), task.type);
    await editor.getByRole("textbox", { name: "Условие", exact: true }).fill(task.prompt);
    if (task.type === "single_choice") {
      await editor.getByLabel(/Варианты/).fill(task.options.join("\n"));
      await choose(editor.getByRole("combobox", { name: "Эталонный ответ", exact: true }), task.answer);
    } else await editor.getByLabel("Эталонный ответ", { exact: true }).fill(task.answer);
    await editor.getByLabel("Навык", { exact: true }).fill(task.skill);
    await editor.getByRole("textbox", { name: "Критерии проверки", exact: true }).fill(task.rubric);
  }
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === "/api/assignments" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  const data = await response.json();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  expect(data.status).toBe("draft");
  expect(data.tasks.map((task: { type: string }) => task.type)).toEqual(tasks.map(task => task.type));
  return data;
}

async function listWork(page: Page, title: string) {
  await page.getByRole("button", { name: /^Задания(?: \d+)?$/ }).click();
  await page.getByPlaceholder("Найти задание").fill(title);
}

async function openWork(page: Page, title: string, id: string) {
  await listWork(page, title);
  await expect(page.locator(".assignment-row")).toHaveCount(1);
  const opened = page.waitForResponse(r => new URL(r.url()).pathname === `/api/assignments/${id}` && r.request().method() === "GET");
  await page.locator(".assignment-row").click();
  const response = await opened;
  expect(response.status()).toBe(200);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  return response.json();
}

async function reloadWork(page: Page, title: string, id: string, discard = false) {
  if (discard) page.once("dialog", dialog => dialog.accept());
  await page.reload();
  return openWork(page, title, id);
}

function contents(data: Record<string, unknown>) {
  return Object.fromEntries(["relationship_id", "title", "instructions", "lesson_id", "due_at", "feedback_policy", "tasks"].map(key => [key, data[key]]));
}

async function expectEditor(page: Page, title: string, note = instructions, firstPrompt: string = tasks[0].prompt) {
  await expect(page.getByLabel("Название работы")).toHaveValue(title);
  await expect(page.getByLabel("Инструкция ученику")).toHaveValue(note);
  await expect(page.locator(".task-editor")).toHaveCount(3);
  for (const [index, task] of tasks.entries()) {
    const editor = page.locator(".task-editor").nth(index);
    await expect(editor.getByRole("textbox", { name: "Условие", exact: true })).toHaveValue(index === 0 ? firstPrompt : task.prompt);
    await expect(editor.getByRole("textbox", { name: "Критерии проверки", exact: true })).toHaveValue(task.rubric);
    if (task.type === "single_choice") {
      await expect(editor.getByLabel(/Варианты/)).toHaveValue(task.options.join("\n"));
      await expect(editor.getByRole("combobox", { name: "Эталонный ответ", exact: true })).toHaveText(task.answer);
    } else await expect(editor.getByLabel("Эталонный ответ", { exact: true })).toHaveValue(task.answer);
  }
}

async function expectPublished(page: Page, title: string, id: string, original: Record<string, unknown>, discard = false) {
  const data = await reloadWork(page, title, id, discard);
  expect(data.status).toBe("published");
  expect(contents(data)).toEqual(contents(original));
  await expect(page.getByRole("button", { name: "Редактировать", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Создать копию", exact: true })).toBeVisible();
  await expect(page.locator(".instructions")).toHaveText(instructions);
  return data;
}

async function expectLearnerWork(page: Page, title: string, id: string) {
  const data = await reloadWork(page, title, id);
  expect(data.status).toBe("published");
  expect(data.tasks.map((task: { type: string; prompt: string; options: string[] }) => ({ type: task.type, prompt: task.prompt, options: task.options })))
    .toEqual(tasks.map(task => ({ type: task.type, prompt: task.prompt, options: [...task.options] })));
  for (const task of data.tasks) {
    expect(task).not.toHaveProperty("answer");
    expect(task).not.toHaveProperty("rubric");
  }
  await expect(page.locator(".instructions")).toHaveText(instructions);
  for (const task of tasks) {
    await expect(page.getByText(task.prompt, { exact: true })).toBeVisible();
    await expect(page.getByText(task.rubric, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByText(tasks[2].answer, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Ответ на задание 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.getByLabel("Ответ на задание 3", { exact: true })).toBeVisible();
}

test("two tutor tabs publish the same three-type draft with pending double clicks and one learner assignment", async ({ page, browser }) => {
  const second = await browser.newPage(), learner = await browser.newPage();
  const release = signal(), firstReached = signal(), secondReached = signal();
  const title = "Одно назначение из двух окон 🧪";
  let firstPublish = 0, secondPublish = 0, firstPuts = 0, secondPuts = 0;
  try {
    await login(page);
    const original = await createDraft(page, title), id = original.id as string;
    await page.getByRole("button", { name: "Редактировать", exact: true }).click();
    await expectEditor(page, title);
    page.on("request", r => { if (new URL(r.url()).pathname === `/api/assignments/${id}` && r.method() === "PUT") firstPuts++; });
    second.on("request", r => { if (new URL(r.url()).pathname === `/api/assignments/${id}` && r.method() === "PUT") secondPuts++; });
    const path = `**/api/assignments/${id}/publish`;
    await page.route(path, async route => {
      firstPublish++;
      firstReached.resolve();
      await release.promise;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.fulfill({ response });
    });
    await second.route(path, async route => {
      secondPublish++;
      secondReached.resolve();
      await release.promise;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "Назначить ученику", exact: true }).dblclick();
    await firstReached.promise;
    await expect(page.getByRole("button", { name: "Назначить ученику", exact: true })).toBeDisabled();
    // The first UI saved revision 2 before starting publication. Open that real
    // saved revision through the second UI so both publications can be pending;
    // no revision is forged and no request bypasses the normal editor.
    await login(second);
    const intermediate = await openWork(second, title, id);
    expect(intermediate.status).toBe("draft");
    expect(intermediate.revision).toBe(original.revision + 1);
    expect(contents(intermediate)).toEqual(contents(original));
    await second.getByRole("button", { name: "Редактировать", exact: true }).click();
    await expectEditor(second, title);
    await second.getByRole("button", { name: "Назначить ученику", exact: true }).dblclick();
    await secondReached.promise;
    await expect(second.getByRole("button", { name: "Назначить ученику", exact: true })).toBeDisabled();
    expect([firstPuts, secondPuts, firstPublish, secondPublish]).toEqual([1, 1, 1, 1]);
    await login(learner, true);
    await listWork(learner, title);
    await expect(learner.locator(".assignment-row")).toHaveCount(0);
    release.resolve();
    for (const tutor of [page, second]) await expect(tutor.getByText("Работа назначена ученику", { exact: true })).toBeVisible();
    const published = await expectPublished(page, title, id, original);
    expect(published.revision).toBe(original.revision + 2);
    await expectPublished(second, title, id, original);
    await expectLearnerWork(learner, title, id);
    expect([firstPuts, secondPuts, firstPublish, secondPublish]).toEqual([1, 1, 1, 1]);
  } finally {
    release.resolve();
    await second.close();
    await learner.close();
  }
});

test("lost publication acknowledgement and a stale second editor cannot overwrite the published three-type work", async ({ page, browser }) => {
  const second = await browser.newPage(), learner = await browser.newPage();
  const committed = signal(), releaseAck = signal();
  const title = "Опубликовано при потерянном ответе 🧪";
  const staleNote = "Поздняя инструкция, которую нельзя опубликовать <>& 🧪";
  const stalePrompt = "Поздняя замена условия 100 + 1 🧪";
  let publications = 0;
  try {
    await login(page);
    const original = await createDraft(page, title), id = original.id as string;
    await page.getByRole("button", { name: "Редактировать", exact: true }).click();
    await login(second);
    await openWork(second, title, id);
    await second.getByRole("button", { name: "Редактировать", exact: true }).click();
    await second.getByLabel("Инструкция ученику").fill(staleNote);
    await second.locator(".task-editor").first().getByRole("textbox", { name: "Условие", exact: true }).fill(stalePrompt);
    await page.route(`**/api/assignments/${id}/publish`, async route => {
      publications++;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committed.resolve();
      await releaseAck.promise;
      await route.abort("connectionreset");
    });
    await page.getByRole("button", { name: "Назначить ученику", exact: true }).dblclick();
    await committed.promise;
    await expect(page.getByRole("button", { name: "Назначить ученику", exact: true })).toBeDisabled();
    await login(learner, true);
    await expectLearnerWork(learner, title, id);
    // Publication really committed while the first tutor is still waiting.
    // The second tutor's existing editor must refuse a late write, not erase it.
    const rejected = second.waitForResponse(r => new URL(r.url()).pathname === `/api/assignments/${id}` && r.request().method() === "PUT");
    await second.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
    const rejectedResponse = await rejected;
    expect(rejectedResponse.status()).toBe(409);
    expect((await rejectedResponse.json()).error.code).toBe("VERSION_CONFLICT");
    await expect(second.getByRole("alert").first()).toContainText("Работа опубликована или изменена в другом окне");
    await expectEditor(second, title, staleNote, stalePrompt);
    await expect(second.getByText("Черновик сохранён", { exact: true })).toHaveCount(0);
    releaseAck.resolve();
    await expect(page.getByRole("alert").first()).toContainText("Не удалось связаться с сервером");
    await expectEditor(page, title);
    await expect(page.getByText("Работа назначена ученику", { exact: true })).toHaveCount(0);
    // The current UI retries PUT before POST /publish. Once published, this
    // correctly conflicts; recovery is reading the committed work from the list.
    const retry = page.waitForResponse(r => new URL(r.url()).pathname === `/api/assignments/${id}` && r.request().method() === "PUT");
    await page.getByRole("button", { name: "Назначить ученику", exact: true }).click();
    expect((await retry).status()).toBe(409);
    await expect(page.getByRole("alert").first()).toContainText("Работа опубликована или изменена в другом окне");
    await expectEditor(page, title);
    expect(publications).toBe(1);
    const published = await expectPublished(page, title, id, original, true);
    expect(published.revision).toBe(original.revision + 1);
    await expectPublished(second, title, id, original, true);
    await expectLearnerWork(learner, title, id);
    await expect(learner.getByText(staleNote, { exact: true })).toHaveCount(0);
    await expect(learner.getByText(stalePrompt, { exact: true })).toHaveCount(0);
    expect(publications).toBe(1);
  } finally {
    releaseAck.resolve();
    await second.close();
    await learner.close();
  }
});
