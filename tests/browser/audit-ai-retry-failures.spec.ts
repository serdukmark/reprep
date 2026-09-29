import { test, expect, choose } from "./audit-fixtures";
import type { BrowserContext, Page } from "@playwright/test";

const title = "Повтор AI: доставка и две вкладки 🧪";
const note = "Сверю исходный ответ вручную — заметка 🧪";
const feedback = "Ручная проверка после отказа AI: ответ 5 верен 🧪";
const retry = (page: Page) => page.getByRole("button", { name: "Повторить AI-проверку", exact: true });
const isRetry = (url: string) => /\/api\/submissions\/[^/]+\/retry$/.test(new URL(url).pathname);
const isDetails = (url: string) => /\/api\/assignments\/[^/]+$/.test(new URL(url).pathname);
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}
async function login(page: Page, role: "tutor" | "learner") {
  await page.goto("/");
  await page.getByRole("button", { name: role === "tutor" ? "Я преподаватель" : "Я ученик", exact: true }).click();
}
async function open(page: Page) {
  const response = page.waitForResponse((r) => isDetails(r.url()) && r.request().method() === "GET");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  const loaded = await response;
  expect(loaded.status()).toBe(200);
  const body = await loaded.json();
  await expect(page.locator(".work-task .original p")).toHaveText("5");
  return body;
}
async function setup(context: BrowserContext) {
  const tutor = await context.newPage(), learner = await context.newPage(), observer = await context.newPage();
  await login(tutor, "tutor");
  await tutor.getByRole("button", { name: "Создать задание", exact: true }).click();
  await tutor.getByLabel("Название работы").fill(title);
  await choose(tutor.getByRole("combobox", { name: "Ученик", exact: true }), "demo-link");
  await tutor.getByLabel("Инструкция ученику").fill("AUD_AI_UNAVAILABLE");
  await tutor.getByRole("textbox", { name: "Условие", exact: true }).fill("2 + 3?");
  await tutor.getByLabel("Эталонный ответ", { exact: true }).fill("5");
  await tutor.getByLabel("Навык", { exact: true }).fill("Сложение");
  await tutor.getByRole("button", { name: "Назначить ученику", exact: true }).click();
  await expect(tutor.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await login(learner, "learner");
  await learner.getByRole("button", { name: new RegExp(title) }).click();
  await learner.getByLabel("Ответ на задание 1").fill("5");
  learner.once("dialog", (d) => d.accept());
  await learner.getByRole("button", { name: "Отправить работу", exact: true }).click();
  await expect(learner.locator(".work-task .original p")).toHaveText("5");
  await tutor.reload();
  const original = await open(tutor);
  await expect(retry(tutor)).toBeVisible({ timeout: 15000 });
  await login(observer, "tutor");
  await open(observer);
  await expect(retry(observer)).toBeVisible();
  await tutor.getByLabel("Комментарий к работе").fill(note);
  return { tutor, learner, observer, original };
}
async function retryOnce(page: Page) {
  await expect(retry(page)).toBeVisible({ timeout: 15000 });
  const response = page.waitForResponse((r) => isRetry(r.url()) && r.request().method() === "POST");
  await retry(page).click();
  expect((await response).status()).toBe(200);
  await expect(retry(page)).toHaveCount(0);
  await expect(retry(page)).toBeVisible({ timeout: 15000 });
}
async function manual(tutor: Page, learner: Page, original: any) {
  await expect(retry(tutor)).toBeVisible({ timeout: 15000 });
  await expect(tutor.getByRole("button", { name: "Подтвердить разбор", exact: true })).toHaveCount(0);
  await choose(tutor.getByRole("combobox", { name: "Результат", exact: true }), "correct");
  await tutor.getByLabel("Комментарий к работе").fill(note);
  await tutor.getByLabel("Обратная связь ученику").fill(feedback);
  await tutor.getByRole("button", { name: "Сохранить мою проверку", exact: true }).click();
  await expect(learner.getByText(feedback, { exact: true })).toBeVisible({ timeout: 15000 });
  await learner.reload();
  const data = await open(learner);
  expect(data.submission.id).toBe(original.submission.id);
  expect(data.submission.attempt).toBe(1);
  expect(data.submission.answers).toEqual(original.submission.answers);
  expect(data.submission.analysis).toBeNull();
  await expect(learner.getByText(feedback, { exact: true })).toBeVisible();
}

test("AI retry: double click and second tutor tab queue one retry, preserve originals and allow manual review", async ({ context }) => {
  const { tutor, learner, observer, original } = await setup(context);
  const committed = gate(), ack = gate(), observerReads = gate();
  let requests = 0, status = 0;
  // Delay polling in the second tab, so its genuine old retry button remains
  // available while the first real retry is queued. No response is fabricated.
  await observer.route("**/api/assignments/*", async (route) => {
    if (route.request().method() === "GET" && isDetails(route.request().url())) await observerReads.promise;
    await route.continue();
  });
  await tutor.route("**/retry", async (route) => {
    requests++;
    const response = await route.fetch();
    status = response.status();
    committed.release();
    await ack.promise;
    await route.fulfill({ response });
  });
  try {
    await retry(tutor).dblclick();
    await committed.promise;
    expect(status).toBe(200);
    expect(requests).toBe(1);
    await expect(retry(tutor)).toBeDisabled();
    await expect(tutor.getByLabel("Комментарий к работе")).toHaveValue(note);
    const rejected = observer.waitForResponse((r) => isRetry(r.url()) && r.request().method() === "POST");
    await retry(observer).click();
    expect((await rejected).status()).toBe(409);
    await expect(observer.getByRole("alert")).toContainText("Повторная проверка сейчас недоступна");
  } finally {
    ack.release();
    observerReads.release();
  }
  await expect(retry(tutor)).toBeEnabled({ timeout: 15000 });
  await expect(tutor.getByLabel("Комментарий к работе")).toHaveValue(note);
  await observer.reload();
  const data = await open(observer);
  expect(data.submission.id).toBe(original.submission.id);
  expect(data.submission.answers).toEqual(original.submission.answers);
  await manual(tutor, learner, original);
});

test("AI retry: lost acknowledgement reloads committed attempt; explicit second retry reaches limit without losing manual path", async ({ context }) => {
  const { tutor, learner, observer, original } = await setup(context);
  const committed = gate(), ack = gate();
  let status = 0, requests = 0;
  await tutor.route("**/retry", async (route) => {
    requests++;
    const response = await route.fetch();
    status = response.status();
    committed.release();
    await ack.promise;
    await route.abort("failed");
  });
  try {
    await retry(tutor).click();
    await committed.promise;
    expect(status).toBe(200);
    await expect(retry(tutor)).toBeDisabled();
    await observer.reload();
    const data = await open(observer);
    expect(data.submission.id).toBe(original.submission.id);
    expect(data.submission.answers).toEqual(original.submission.answers);
    expect(data.submission.attempt).toBe(1);
  } finally { ack.release(); }
  await expect(tutor.getByRole("alert")).toBeVisible();
  await expect(tutor.getByLabel("Комментарий к работе")).toHaveValue(note);
  expect(requests).toBe(1);
  await tutor.unroute("**/retry");
  // Reload deliberately discards the unsaved note. This test does not promise
  // note recovery or idempotency for separate, explicit AI retries.
  await tutor.reload();
  await open(tutor);
  await retryOnce(tutor);
  const rejected = tutor.waitForResponse((r) => isRetry(r.url()) && r.request().method() === "POST");
  await retry(tutor).click();
  expect((await rejected).status()).toBe(409);
  await expect(tutor.getByRole("alert")).toContainText("Повторная проверка сейчас недоступна");
  await manual(tutor, learner, original);
});

test("AI retry: real revoked tutor session returns401, preserves open note and allows fresh login and manual review", async ({ context }) => {
  const { tutor, learner, observer, original } = await setup(context);
  const revoker = await context.newPage();
  const token = await tutor.evaluate(() => sessionStorage.getItem("reprep.session"));
  expect(Boolean(token)).toBe(true);
  await revoker.addInitScript((value) => sessionStorage.setItem("reprep.session", value!), token);
  await revoker.goto("/");
  await revoker.getByRole("button", { name: /Алекс • демо/ }).click();
  const revoked = revoker.waitForResponse((r) => new URL(r.url()).pathname === "/api/logout" && r.request().method() === "POST");
  await revoker.getByRole("button", { name: "Выйти", exact: true }).click();
  expect((await revoked).status()).toBe(200);
  const rejected = tutor.waitForResponse((r) => isRetry(r.url()) && r.request().method() === "POST");
  await retry(tutor).click();
  expect((await rejected).status()).toBe(401);
  await expect(tutor.getByRole("alert")).toBeVisible();
  await expect(tutor.getByLabel("Комментарий к работе")).toHaveValue(note);
  await expect(tutor.locator(".work-task .original p")).toHaveText("5");
  await observer.reload();
  const unchanged = await open(observer);
  expect(unchanged.submission.id).toBe(original.submission.id);
  expect(unchanged.submission.answers).toEqual(original.submission.answers);
  expect(unchanged.submission.status).toBe("awaiting_review");
  await tutor.reload();
  await tutor.getByRole("button", { name: "Я преподаватель", exact: true }).click();
  await open(tutor);
  await retryOnce(tutor);
  await manual(tutor, learner, original);
});
